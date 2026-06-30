import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import type { ScheduleNotificationConfig } from '@playwright-platform/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsService } from '../secrets/secrets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { stringifyJsonArray } from '../common/json-array.util';
import { RunQueueService } from './run-queue.service';
import {
  appendRunLog,
  readRunLog,
  readCaseOutputLog,
  resolveArtifactPath,
  runGherkinFeature,
  runPlaywrightSpec,
} from './playwright-runner.service';
import { parseCucumberReport } from './cucumber-report.util';
import { parsePlaywrightReport } from './report.util';
import { toTestRunDetail } from './test-runs.mapper';
import { extractRunnerError, validateTestCaseFiles } from './test-case-files.util';
import { parseRunArtifactsConfig } from './run-artifacts.util';
import { extractStepsFromReport } from './step-report.util';

@Injectable()
export class TestRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretsService: SecretsService,
    private readonly runQueue: RunQueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findByProject(projectId: string) {
    return this.prisma.testRun
      .findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        include: {
          suite: { select: { name: true } },
          environment: { select: { name: true } },
          _count: { select: { testResults: true } },
        },
      })
      .then((runs) =>
        runs.map(({ _count, suite, environment, ...run }) => ({
          id: run.id,
          projectId: run.projectId,
          suiteId: run.suiteId ?? undefined,
          suiteName: suite?.name,
          environmentId: run.environmentId ?? undefined,
          environmentName: environment?.name,
          status: run.status,
          triggeredBy: run.triggeredBy,
          headed: run.headed,
          startedAt: run.startedAt?.toISOString(),
          endedAt: run.endedAt?.toISOString(),
          createdAt: run.createdAt.toISOString(),
          resultCount: _count.testResults,
        })),
      );
  }

  async findOne(id: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id },
      include: {
        suite: { select: { name: true } },
        environment: { select: { name: true } },
        testResults: {
          include: { testCase: { select: { name: true, filePath: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) {
      throw new NotFoundException(`Test run ${id} not found`);
    }
    return toTestRunDetail(run);
  }

  async triggerSuiteRun(
    suiteId: string,
    options: {
      environmentId?: string;
      triggeredBy?: 'manual' | 'schedule';
      scheduleId?: string;
      headed?: boolean;
    } = {},
  ) {
    const suite = await this.prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: { testCases: { orderBy: { createdAt: 'asc' } } },
    });
    if (!suite) {
      throw new NotFoundException(`Test suite ${suiteId} not found`);
    }
    if (suite.testCases.length === 0) {
      throw new BadRequestException('Suite has no test cases to run');
    }

    if (options.environmentId) {
      const environment = await this.prisma.environment.findFirst({
        where: { id: options.environmentId, projectId: suite.projectId },
      });
      if (!environment) {
        throw new BadRequestException('Environment does not belong to this project');
      }
    }

    const run = await this.prisma.testRun.create({
      data: {
        projectId: suite.projectId,
        suiteId: suite.id,
        scheduleId: options.scheduleId ?? null,
        environmentId: options.environmentId ?? null,
        status: 'pending',
        triggeredBy: options.triggeredBy ?? 'manual',
        headed: options.headed ?? false,
      },
    });

    await this.prisma.testResult.createMany({
      data: suite.testCases.map((testCase) => ({
        runId: run.id,
        testCaseId: testCase.id,
        status: 'pending',
      })),
    });

    void this.runQueue.enqueue(() => this.executeRun(run.id));

    return this.findOne(run.id);
  }

  getLog(id: string) {
    return readRunLog(id);
  }

  async getResultLog(resultId: string) {
    const result = await this.prisma.testResult.findUnique({
      where: { id: resultId },
      include: { testCase: { select: { filePath: true, type: true } } },
    });
    if (!result) {
      throw new NotFoundException(`Test result ${resultId} not found`);
    }

    const log = await readCaseOutputLog(result.runId, result.testCase.filePath);
    if (log === null) {
      throw new NotFoundException('Case log not available yet');
    }
    return log;
  }

  async getArtifact(id: string, relativePath: string) {
    await this.ensureRunExists(id);
    const fullPath = resolveArtifactPath(id, relativePath);
    try {
      return await fs.readFile(fullPath);
    } catch {
      throw new NotFoundException('Artifact not found');
    }
  }

  getQueueStats() {
    return this.runQueue.getStats();
  }

  private async executeRun(runId: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        environment: true,
        testResults: { include: { testCase: true } },
        project: { select: { runArtifactsConfig: true } },
      },
    });
    if (!run) return;

    const artifactsConfig = parseRunArtifactsConfig(run.project.runArtifactsConfig);

    const logPath = await appendRunLog(runId, `Starting run ${runId}\n`);
    await this.prisma.testRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date(), logPath },
    });

    const secrets = await this.secretsService.resolveForRun(
      run.projectId,
      run.environmentId ?? undefined,
    );
    const baseEnv: Record<string, string> = {
      ...secrets,
      BASE_URL: run.environment?.baseUrl ?? 'https://example.com',
    };
    const headed = run.headed;

    let runFailed = false;

    for (const result of run.testResults) {
      const testCase = result.testCase;
      await appendRunLog(
        runId,
        `\n--- ${testCase.name} (${testCase.type})${headed ? ' [headed]' : ''} ---\n`,
      );

      const started = Date.now();
      try {
        const missingFile = await validateTestCaseFiles(testCase.type, testCase.filePath);
        if (missingFile) {
          await appendRunLog(runId, `Preflight failed: ${missingFile}\n`);
          runFailed = true;
          await this.prisma.testResult.update({
            where: { id: result.id },
            data: {
              status: 'failed',
              durationMs: Date.now() - started,
              errorMessage: missingFile,
            },
          });
          continue;
        }

        const runnerResult =
          testCase.type === 'gherkin'
            ? await runGherkinFeature(runId, testCase.filePath, baseEnv, { headed, artifacts: artifactsConfig })
            : await runPlaywrightSpec(runId, testCase.filePath, baseEnv, { headed, artifacts: artifactsConfig });
        await appendRunLog(runId, runnerResult.log);

        let passed = runnerResult.exitCode === 0;
        let errorMessage: string | undefined;
        let stepsJson = '[]';

        try {
          const reportRaw = await fs.readFile(runnerResult.reportPath, 'utf8');
          const report = JSON.parse(reportRaw);
          const parsed =
            testCase.type === 'gherkin'
              ? parseCucumberReport(report)
              : parsePlaywrightReport(report);
          passed = parsed.passed;
          errorMessage = parsed.errorMessage;
          stepsJson = JSON.stringify(extractStepsFromReport(testCase.type, report));
        } catch {
          if (runnerResult.exitCode !== 0) {
            passed = false;
            errorMessage = extractRunnerError(
              runnerResult.log,
              testCase.type === 'gherkin'
                ? 'Cucumber exited with a non-zero status'
                : 'Playwright exited with a non-zero status',
            );
          }
        }

        await this.prisma.testResult.update({
          where: { id: result.id },
          data: {
            status: passed ? 'passed' : 'failed',
            durationMs: Date.now() - started,
            errorMessage: passed ? null : errorMessage,
            artifactPaths: stringifyJsonArray(runnerResult.artifactPaths),
            stepsJson,
          },
        });

        if (!passed) runFailed = true;
      } catch (error) {
        runFailed = true;
        const message = error instanceof Error ? error.message : 'Unknown runner error';
        await appendRunLog(runId, `Error: ${message}\n`);
        await this.prisma.testResult.update({
          where: { id: result.id },
          data: {
            status: 'failed',
            durationMs: Date.now() - started,
            errorMessage: message,
          },
        });
      }
    }

    const finalStatus = runFailed ? 'failed' : 'passed';
    await appendRunLog(runId, `\nRun finished: ${finalStatus}\n`);
    await this.prisma.testRun.update({
      where: { id: runId },
      data: { status: finalStatus, endedAt: new Date() },
    });

    if (runFailed && run.scheduleId) {
      void this.sendScheduleFailureNotification(runId);
    }
  }

  private async sendScheduleFailureNotification(runId: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        project: { select: { name: true } },
        suite: { select: { name: true } },
        schedule: true,
        testResults: {
          where: { status: 'failed' },
          include: { testCase: { select: { name: true } } },
        },
      },
    });
    if (!run?.schedule?.notificationConfig) return;

    let config: ScheduleNotificationConfig;
    try {
      config = JSON.parse(run.schedule.notificationConfig);
    } catch {
      return;
    }

    const appBaseUrl = process.env['APP_BASE_URL'] ?? 'http://localhost:4200';
    await this.notificationsService.notifyScheduleFailure(config, {
      scheduleName: run.schedule.name,
      projectName: run.project.name,
      suiteName: run.suite?.name,
      runId: run.id,
      projectId: run.projectId,
      failedTests: run.testResults.map((result) => ({
        name: result.testCase.name,
        errorMessage: result.errorMessage ?? undefined,
      })),
      runUrl: `${appBaseUrl}/projects/${run.projectId}/runs/${run.id}`,
    });
  }

  private async ensureRunExists(id: string) {
    const run = await this.prisma.testRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException(`Test run ${id} not found`);
    }
    return run;
  }
}
