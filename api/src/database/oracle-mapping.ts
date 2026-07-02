import type { JsonStoreSnapshot } from './database.types';
import { MODEL_STORE_KEYS } from './model-relations';

type TableSpec = {
  table: string;
  key: keyof JsonStoreSnapshot;
  columns: Array<{ field: string; column: string; type: 'string' | 'number' | 'boolean' | 'date' | 'clob' }>;
};

export const ORACLE_TABLES: TableSpec[] = [
  {
    table: 'pp_project',
    key: 'projects',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'description', column: 'description', type: 'clob' },
      { field: 'runArtifactsConfig', column: 'run_artifacts_config', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_environment',
    key: 'environments',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'baseUrl', column: 'base_url', type: 'string' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_test_suite',
    key: 'testSuites',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'description', column: 'description', type: 'clob' },
      { field: 'tags', column: 'tags', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_test_case',
    key: 'testCases',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'suiteId', column: 'suite_id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'type', column: 'type', type: 'string' },
      { field: 'filePath', column: 'file_path', type: 'string' },
      { field: 'tags', column: 'tags', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_step_definition',
    key: 'stepDefinitions',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'pattern', column: 'pattern', type: 'clob' },
      { field: 'helperFunction', column: 'helper_function', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_page_object',
    key: 'pageObjects',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'screenName', column: 'screen_name', type: 'string' },
      { field: 'version', column: 'version', type: 'number' },
      { field: 'classFilePath', column: 'class_file_path', type: 'string' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_secret',
    key: 'secrets',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'environmentId', column: 'environment_id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'encryptedValue', column: 'encrypted_value', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_user',
    key: 'users',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'email', column: 'email', type: 'string' },
      { field: 'passwordHash', column: 'password_hash', type: 'string' },
      { field: 'role', column: 'role', type: 'string' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_schedule',
    key: 'schedules',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'name', column: 'name', type: 'string' },
      { field: 'cronExpression', column: 'cron_expression', type: 'string' },
      { field: 'suiteIds', column: 'suite_ids', type: 'clob' },
      { field: 'environmentId', column: 'environment_id', type: 'string' },
      { field: 'enabled', column: 'enabled', type: 'boolean' },
      { field: 'notificationConfig', column: 'notification_config', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
      { field: 'updatedAt', column: 'updated_at', type: 'date' },
    ],
  },
  {
    table: 'pp_test_run',
    key: 'testRuns',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'projectId', column: 'project_id', type: 'string' },
      { field: 'suiteId', column: 'suite_id', type: 'string' },
      { field: 'scheduleId', column: 'schedule_id', type: 'string' },
      { field: 'environmentId', column: 'environment_id', type: 'string' },
      { field: 'status', column: 'status', type: 'string' },
      { field: 'triggeredBy', column: 'triggered_by', type: 'string' },
      { field: 'headed', column: 'headed', type: 'boolean' },
      { field: 'logPath', column: 'log_path', type: 'string' },
      { field: 'startedAt', column: 'started_at', type: 'date' },
      { field: 'endedAt', column: 'ended_at', type: 'date' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
    ],
  },
  {
    table: 'pp_test_result',
    key: 'testResults',
    columns: [
      { field: 'id', column: 'id', type: 'string' },
      { field: 'runId', column: 'run_id', type: 'string' },
      { field: 'testCaseId', column: 'test_case_id', type: 'string' },
      { field: 'status', column: 'status', type: 'string' },
      { field: 'durationMs', column: 'duration_ms', type: 'number' },
      { field: 'errorMessage', column: 'error_message', type: 'clob' },
      { field: 'artifactPaths', column: 'artifact_paths', type: 'clob' },
      { field: 'stepsJson', column: 'steps_json', type: 'clob' },
      { field: 'createdAt', column: 'created_at', type: 'date' },
    ],
  },
];

export function modelKeyForStoreKey(storeKey: keyof JsonStoreSnapshot): string {
  return Object.entries(MODEL_STORE_KEYS).find(([, value]) => value === storeKey)?.[0] ?? storeKey;
}

export type OracleModule = {
  createPool(config: Record<string, string>): Promise<{
    getConnection(): Promise<OracleConnection>;
    close(): Promise<void>;
  }>;
};

export type OracleConnection = {
  execute<T = unknown>(sql: string, binds?: Record<string, unknown> | unknown[]): Promise<{ rows?: T[] }>;
  commit(): Promise<void>;
  close(): Promise<void>;
};

export function rowToRecord(
  row: Record<string, unknown>,
  columns: TableSpec['columns'],
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const column of columns) {
    const raw = row[column.column.toUpperCase()] ?? row[column.column];
    if (raw == null) {
      record[column.field] = null;
      continue;
    }
    if (column.type === 'date') {
      record[column.field] = raw instanceof Date ? raw : new Date(String(raw));
    } else if (column.type === 'boolean') {
      record[column.field] = raw === 1 || raw === true || raw === '1';
    } else if (column.type === 'number') {
      record[column.field] = Number(raw);
    } else {
      record[column.field] = raw;
    }
  }
  return record;
}

export function recordToBinds(
  record: Record<string, unknown>,
  columns: TableSpec['columns'],
): Record<string, unknown> {
  const binds: Record<string, unknown> = {};
  for (const column of columns) {
    const value = record[column.field];
    if (column.type === 'boolean') {
      binds[column.column] = value ? 1 : 0;
    } else if (column.type === 'date') {
      binds[column.column] = value instanceof Date ? value : value ? new Date(String(value)) : null;
    } else {
      binds[column.column] = value ?? null;
    }
  }
  return binds;
}
