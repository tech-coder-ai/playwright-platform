import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseJsonArray } from '../common/json-array.util';
import type {
  DashboardData,
  DashboardRunTrendPoint,
  DashboardSummary,
  DashboardTrendPoint,
  FlakyTestRow,
  RecentFailureRow,
  SuiteHealthRow,
} from '@playwright-platform/shared-types';

const COMPLETED_STATUSES = ['passed', 'failed'] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(projectId?: string, runLimit = 30): Promise<DashboardData> {
    const runWhere = {
      ...(projectId ? { projectId } : {}),
      status: { in: [...COMPLETED_STATUSES] },
    };

    const completedRuns = await this.prisma.testRun.findMany({
      where: runWhere,
      orderBy: { createdAt: 'desc' },
      take: runLimit,
      include: {
        project: { select: { name: true } },
        suite: { select: { id: true, name: true } },
        testResults: { select: { status: true } },
      },
    });

    const summary = this.buildSummary(completedRuns);
    const dailyTrend = this.buildDailyTrend(completedRuns);
    const runTrend = this.buildRunTrend(completedRuns);
    const suiteHealth = await this.buildSuiteHealth(projectId, runLimit);
    const flakyTests = await this.buildFlakyTests(projectId, runLimit);
    const recentFailures = await this.buildRecentFailures(projectId, 10);

    return {
      summary,
      dailyTrend,
      runTrend: runTrend.reverse(),
      suiteHealth,
      flakyTests,
      recentFailures,
    };
  }

  private buildSummary(
    runs: Array<{ status: string }>,
  ): DashboardSummary {
    const totalRuns = runs.length;
    const passedRuns = runs.filter((r) => r.status === 'passed').length;
    const failedRuns = runs.filter((r) => r.status === 'failed').length;
    const passRate = totalRuns === 0 ? 0 : Math.round((passedRuns / totalRuns) * 100);
    return { totalRuns, passedRuns, failedRuns, passRate };
  }

  private buildDailyTrend(
    runs: Array<{ status: string; createdAt: Date }>,
  ): DashboardTrendPoint[] {
    const buckets = new Map<string, { passed: number; failed: number }>();

    for (const run of runs) {
      const date = formatLocalDate(run.createdAt);
      const bucket = buckets.get(date) ?? { passed: 0, failed: 0 };
      if (run.status === 'passed') bucket.passed++;
      if (run.status === 'failed') bucket.failed++;
      buckets.set(date, bucket);
    }

    const points: DashboardTrendPoint[] = [];
    const today = new Date();
    for (let offset = 13; offset >= 0; offset--) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const date = formatLocalDate(day);
      const counts = buckets.get(date) ?? { passed: 0, failed: 0 };
      points.push({
        date,
        passed: counts.passed,
        failed: counts.failed,
        total: counts.passed + counts.failed,
      });
    }

    return points;
  }

  private buildRunTrend(
    runs: Array<{
      id: string;
      projectId: string;
      status: string;
      createdAt: Date;
      project: { name: string };
      suite: { name: string } | null;
      testResults: Array<{ status: string }>;
    }>,
  ): DashboardRunTrendPoint[] {
    return runs.map((run) => ({
      runId: run.id,
      projectId: run.projectId,
      projectName: run.project.name,
      suiteName: run.suite?.name,
      status: run.status,
      passedCount: run.testResults.filter((r) => r.status === 'passed').length,
      failedCount: run.testResults.filter((r) => r.status === 'failed').length,
      createdAt: run.createdAt.toISOString(),
    }));
  }

  private async buildSuiteHealth(
    projectId: string | undefined,
    runLimit: number,
  ): Promise<SuiteHealthRow[]> {
    const suites = await this.prisma.testSuite.findMany({
      where: projectId ? { projectId } : {},
      include: { project: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    const rows: SuiteHealthRow[] = [];

    for (const suite of suites) {
      const runs = await this.prisma.testRun.findMany({
        where: {
          suiteId: suite.id,
          status: { in: [...COMPLETED_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
        take: runLimit,
      });

      const totalRuns = runs.length;
      const passedRuns = runs.filter((r) => r.status === 'passed').length;
      const lastRun = runs[0];

      rows.push({
        projectId: suite.projectId,
        projectName: suite.project.name,
        suiteId: suite.id,
        suiteName: suite.name,
        totalRuns,
        passRate: totalRuns === 0 ? 0 : Math.round((passedRuns / totalRuns) * 100),
        lastRunStatus: lastRun?.status,
        lastRunAt: lastRun?.createdAt.toISOString(),
      });
    }

    return rows.sort((a, b) => (a.passRate ?? 100) - (b.passRate ?? 100));
  }

  private async buildFlakyTests(
    projectId: string | undefined,
    runLimit: number,
  ): Promise<FlakyTestRow[]> {
    const recentRuns = await this.prisma.testRun.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: { in: [...COMPLETED_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: runLimit,
      select: { id: true, createdAt: true },
    });

    if (recentRuns.length === 0) return [];

    const results = await this.prisma.testResult.findMany({
      where: {
        runId: { in: recentRuns.map((r) => r.id) },
        status: { in: ['passed', 'failed'] },
      },
      include: {
        testCase: {
          include: {
            suite: { include: { project: { select: { name: true } } } },
          },
        },
        run: { select: { createdAt: true } },
      },
    });

    const grouped = new Map<
      string,
      {
        testCaseId: string;
        testCaseName: string;
        suiteId: string;
        suiteName: string;
        projectId: string;
        projectName: string;
        outcomes: Array<{ status: 'passed' | 'failed'; at: Date }>;
      }
    >();

    for (const result of results) {
      const key = result.testCaseId;
      const entry = grouped.get(key) ?? {
        testCaseId: result.testCaseId,
        testCaseName: result.testCase.name,
        suiteId: result.testCase.suiteId,
        suiteName: result.testCase.suite.name,
        projectId: result.testCase.suite.projectId,
        projectName: result.testCase.suite.project.name,
        outcomes: [],
      };
      entry.outcomes.push({
        status: result.status as 'passed' | 'failed',
        at: result.run.createdAt,
      });
      grouped.set(key, entry);
    }

    const flaky: FlakyTestRow[] = [];
    for (const entry of grouped.values()) {
      const chronological = [...entry.outcomes].sort((a, b) => a.at.getTime() - b.at.getTime());
      const passes = chronological.filter((o) => o.status === 'passed').length;
      const failures = chronological.filter((o) => o.status === 'failed').length;
      const executions = passes + failures;

      if (executions < 2 || passes === 0 || failures === 0) continue;

      let statusFlips = 0;
      for (let i = 1; i < chronological.length; i++) {
        if (chronological[i].status !== chronological[i - 1].status) {
          statusFlips++;
        }
      }

      const lastFailure = [...chronological].reverse().find((o) => o.status === 'failed');

      flaky.push({
        projectId: entry.projectId,
        projectName: entry.projectName,
        suiteId: entry.suiteId,
        suiteName: entry.suiteName,
        testCaseId: entry.testCaseId,
        testCaseName: entry.testCaseName,
        executions,
        passes,
        failures,
        failureRate: Math.round((failures / executions) * 100),
        statusFlips,
        flakyScore: Math.round((statusFlips / Math.max(executions - 1, 1)) * 100),
        lastFailureAt: lastFailure?.at.toISOString(),
      });
    }

    return flaky
      .sort((a, b) => b.flakyScore - a.flakyScore || b.failureRate - a.failureRate)
      .slice(0, 10);
  }

  private async buildRecentFailures(
    projectId: string | undefined,
    limit: number,
  ): Promise<RecentFailureRow[]> {
    const failures = await this.prisma.testResult.findMany({
      where: {
        status: 'failed',
        run: {
          ...(projectId ? { projectId } : {}),
          status: { in: [...COMPLETED_STATUSES] },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        testCase: { select: { id: true, name: true } },
        run: {
          include: {
            project: { select: { name: true } },
            suite: { select: { name: true } },
          },
        },
      },
    });

    return failures.map((failure) => ({
      runId: failure.runId,
      projectId: failure.run.projectId,
      projectName: failure.run.project.name,
      suiteName: failure.run.suite?.name,
      testCaseId: failure.testCaseId,
      testCaseName: failure.testCase.name,
      errorMessage: failure.errorMessage ?? undefined,
      failedAt: failure.createdAt.toISOString(),
      artifactPaths: parseJsonArray(failure.artifactPaths),
    }));
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
