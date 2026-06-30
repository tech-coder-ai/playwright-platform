import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as cron from 'node-cron';
import { PrismaService } from '../prisma/prisma.service';
import { TestRunsService } from '../test-runner/test-runs.service';
import { parseJsonArray } from '../common/json-array.util';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly jobs = new Map<string, cron.ScheduledTask>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly testRunsService: TestRunsService,
  ) {}

  async onModuleInit() {
    const schedules = await this.prisma.schedule.findMany({ where: { enabled: true } });
    for (const schedule of schedules) {
      this.registerJob(schedule.id, schedule.cronExpression);
    }
    this.logger.log(`Registered ${this.jobs.size} schedule(s)`);
  }

  onModuleDestroy() {
    for (const task of this.jobs.values()) {
      task.stop();
    }
    this.jobs.clear();
  }

  async refreshSchedule(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      this.unregisterJob(scheduleId);
      return;
    }
    if (!schedule.enabled) {
      this.unregisterJob(scheduleId);
      return;
    }
    this.registerJob(schedule.id, schedule.cronExpression);
  }

  unregisterSchedule(scheduleId: string) {
    this.unregisterJob(scheduleId);
  }

  validateCronExpression(expression: string): boolean {
    return cron.validate(expression);
  }

  async runNow(scheduleId: string) {
    await this.fireSchedule(scheduleId);
  }

  private registerJob(scheduleId: string, cronExpression: string) {
    this.unregisterJob(scheduleId);

    if (!cron.validate(cronExpression)) {
      this.logger.warn(`Invalid cron expression for schedule ${scheduleId}: ${cronExpression}`);
      return;
    }

    const task = cron.schedule(cronExpression, () => {
      void this.fireSchedule(scheduleId);
    });

    this.jobs.set(scheduleId, task);
    this.logger.log(`Scheduled ${scheduleId} with cron "${cronExpression}"`);
  }

  private unregisterJob(scheduleId: string) {
    const existing = this.jobs.get(scheduleId);
    if (existing) {
      existing.stop();
      this.jobs.delete(scheduleId);
    }
  }

  private async fireSchedule(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule?.enabled) return;

    const suiteIds = parseJsonArray(schedule.suiteIds);
    this.logger.log(`Firing schedule "${schedule.name}" (${scheduleId}) for ${suiteIds.length} suite(s)`);

    for (const suiteId of suiteIds) {
      try {
        await this.testRunsService.triggerSuiteRun(suiteId, {
          environmentId: schedule.environmentId ?? undefined,
          triggeredBy: 'schedule',
          scheduleId: schedule.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Schedule ${scheduleId} failed to run suite ${suiteId}: ${message}`);
      }
    }
  }
}
