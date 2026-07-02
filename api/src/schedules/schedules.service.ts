import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ScheduleNotificationConfig } from '@playwright-platform/shared-types';
import { DatabaseService } from '../database/database.service';
import { ensureProjectExists } from '../common/ensure-exists.util';
import { stringifyJsonArray } from '../common/json-array.util';
import { SchedulerService } from './scheduler.service';
import { toSchedule } from './schedules.mapper';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly scheduler: SchedulerService,
  ) {}

  async findByProject(projectId: string) {
    await ensureProjectExists(this.db, projectId);
    const schedules = await this.db.schedule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { environment: { select: { name: true } } },
    });
    return schedules.map(toSchedule);
  }

  async findOne(id: string) {
    const schedule = await this.db.schedule.findUnique({
      where: { id },
      include: { environment: { select: { name: true } } },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }
    return toSchedule(schedule);
  }

  async create(
    projectId: string,
    data: {
      name: string;
      cronExpression: string;
      suiteIds: string[];
      environmentId?: string;
      enabled?: boolean;
      notificationConfig?: ScheduleNotificationConfig;
    },
  ) {
    await ensureProjectExists(this.db, projectId);
    this.assertValidCron(data.cronExpression);
    await this.validateSuites(projectId, data.suiteIds);
    await this.validateEnvironment(projectId, data.environmentId);

    const schedule = await this.db.schedule.create({
      data: {
        projectId,
        name: data.name.trim(),
        cronExpression: data.cronExpression.trim(),
        suiteIds: stringifyJsonArray(data.suiteIds),
        environmentId: data.environmentId ?? null,
        enabled: data.enabled ?? true,
        notificationConfig: serializeNotificationConfig(data.notificationConfig),
      },
      include: { environment: { select: { name: true } } },
    });

    await this.scheduler.refreshSchedule(schedule.id);
    return toSchedule(schedule);
  }

  async update(
    id: string,
    data: {
      name?: string;
      cronExpression?: string;
      suiteIds?: string[];
      environmentId?: string | null;
      enabled?: boolean;
      notificationConfig?: ScheduleNotificationConfig | null;
    },
  ) {
    const existing = await this.db.schedule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    if (data.cronExpression !== undefined) {
      this.assertValidCron(data.cronExpression);
    }
    if (data.suiteIds !== undefined) {
      await this.validateSuites(existing.projectId, data.suiteIds);
    }
    if (data.environmentId !== undefined) {
      await this.validateEnvironment(existing.projectId, data.environmentId ?? undefined);
    }

    const schedule = await this.db.schedule.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        cronExpression: data.cronExpression?.trim(),
        suiteIds: data.suiteIds !== undefined ? stringifyJsonArray(data.suiteIds) : undefined,
        environmentId: data.environmentId,
        enabled: data.enabled,
        notificationConfig:
          data.notificationConfig !== undefined
            ? serializeNotificationConfig(data.notificationConfig ?? undefined)
            : undefined,
      },
      include: { environment: { select: { name: true } } },
    });

    await this.scheduler.refreshSchedule(schedule.id);
    return toSchedule(schedule);
  }

  async remove(id: string) {
    await this.findOne(id);
    this.scheduler.unregisterSchedule(id);
    return this.db.schedule.delete({ where: { id } });
  }

  async runNow(id: string) {
    await this.findOne(id);
    await this.scheduler.runNow(id);
    return { status: 'queued' };
  }

  private assertValidCron(expression: string) {
    if (!this.scheduler.validateCronExpression(expression.trim())) {
      throw new BadRequestException(`Invalid cron expression: ${expression}`);
    }
  }

  private async validateSuites(projectId: string, suiteIds: string[]) {
    if (suiteIds.length === 0) {
      throw new BadRequestException('At least one test suite is required');
    }
    const suites = await this.db.testSuite.findMany({
      where: { projectId, id: { in: suiteIds } },
    });
    if (suites.length !== suiteIds.length) {
      throw new BadRequestException('One or more suites do not belong to this project');
    }
  }

  private async validateEnvironment(projectId: string, environmentId?: string) {
    if (!environmentId) return;
    const environment = await this.db.environment.findFirst({
      where: { id: environmentId, projectId },
    });
    if (!environment) {
      throw new BadRequestException('Environment does not belong to this project');
    }
  }
}

function serializeNotificationConfig(
  config: ScheduleNotificationConfig | undefined,
): string | null {
  if (!config) return null;
  return JSON.stringify(config);
}
