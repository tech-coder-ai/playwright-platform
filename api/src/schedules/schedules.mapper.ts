import { parseJsonArray } from '../common/json-array.util';
import type { ScheduleNotificationConfig } from '@playwright-platform/shared-types';

type ScheduleRecord = {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  suiteIds: string;
  environmentId: string | null;
  enabled: boolean;
  notificationConfig: string | null;
  createdAt: Date;
  updatedAt: Date;
  environment?: { name: string } | null;
};

export function toSchedule(schedule: ScheduleRecord) {
  let notificationConfig: ScheduleNotificationConfig | undefined;
  if (schedule.notificationConfig) {
    try {
      notificationConfig = JSON.parse(schedule.notificationConfig);
    } catch {
      notificationConfig = undefined;
    }
  }

  return {
    id: schedule.id,
    projectId: schedule.projectId,
    name: schedule.name,
    cronExpression: schedule.cronExpression,
    suiteIds: parseJsonArray(schedule.suiteIds),
    environmentId: schedule.environmentId ?? undefined,
    environmentName: schedule.environment?.name,
    enabled: schedule.enabled,
    notificationConfig,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}
