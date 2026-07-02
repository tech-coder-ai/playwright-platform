export type RelationDef = {
  model: string;
  foreignKey: string;
  localKey?: string;
  many?: boolean;
};

export type ModelRelations = Record<string, RelationDef>;

export const MODEL_RELATIONS: Record<string, ModelRelations> = {
  project: {
    environments: { model: 'environment', foreignKey: 'projectId', localKey: 'id', many: true },
    testSuites: { model: 'testSuite', foreignKey: 'projectId', localKey: 'id', many: true },
    stepDefinitions: { model: 'stepDefinition', foreignKey: 'projectId', localKey: 'id', many: true },
    pageObjects: { model: 'pageObject', foreignKey: 'projectId', localKey: 'id', many: true },
    secrets: { model: 'secret', foreignKey: 'projectId', localKey: 'id', many: true },
    schedules: { model: 'schedule', foreignKey: 'projectId', localKey: 'id', many: true },
    testRuns: { model: 'testRun', foreignKey: 'projectId', localKey: 'id', many: true },
  },
  environment: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
    secrets: { model: 'secret', foreignKey: 'environmentId', localKey: 'id', many: true },
    testRuns: { model: 'testRun', foreignKey: 'environmentId', localKey: 'id', many: true },
    schedules: { model: 'schedule', foreignKey: 'environmentId', localKey: 'id', many: true },
  },
  testSuite: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
    testCases: { model: 'testCase', foreignKey: 'suiteId', localKey: 'id', many: true },
    testRuns: { model: 'testRun', foreignKey: 'suiteId', localKey: 'id', many: true },
  },
  testCase: {
    suite: { model: 'testSuite', foreignKey: 'suiteId', localKey: 'id' },
    testResults: { model: 'testResult', foreignKey: 'testCaseId', localKey: 'id', many: true },
  },
  stepDefinition: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
  },
  pageObject: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
  },
  secret: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
    environment: { model: 'environment', foreignKey: 'environmentId', localKey: 'id' },
  },
  schedule: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
    environment: { model: 'environment', foreignKey: 'environmentId', localKey: 'id' },
    testRuns: { model: 'testRun', foreignKey: 'scheduleId', localKey: 'id', many: true },
  },
  testRun: {
    project: { model: 'project', foreignKey: 'projectId', localKey: 'id' },
    suite: { model: 'testSuite', foreignKey: 'suiteId', localKey: 'id' },
    schedule: { model: 'schedule', foreignKey: 'scheduleId', localKey: 'id' },
    environment: { model: 'environment', foreignKey: 'environmentId', localKey: 'id' },
    testResults: { model: 'testResult', foreignKey: 'runId', localKey: 'id', many: true },
  },
  testResult: {
    run: { model: 'testRun', foreignKey: 'runId', localKey: 'id' },
    testCase: { model: 'testCase', foreignKey: 'testCaseId', localKey: 'id' },
  },
};

export const MODEL_STORE_KEYS: Record<string, keyof import('./database.types').JsonStoreSnapshot> = {
  project: 'projects',
  environment: 'environments',
  testSuite: 'testSuites',
  testCase: 'testCases',
  stepDefinition: 'stepDefinitions',
  pageObject: 'pageObjects',
  secret: 'secrets',
  user: 'users',
  schedule: 'schedules',
  testRun: 'testRuns',
  testResult: 'testResults',
};

export const MODEL_DEFAULTS: Record<string, Record<string, unknown>> = {
  project: {
    runArtifactsConfig: '{"screenshot":"on-failure","video":"on-failure"}',
  },
  testSuite: { tags: '[]' },
  testCase: { tags: '[]' },
  pageObject: { version: 1 },
  schedule: { suiteIds: '[]', enabled: true },
  testRun: { status: 'pending', triggeredBy: 'manual', headed: false },
  testResult: { artifactPaths: '[]', stepsJson: '[]' },
};

export const MODEL_TIMESTAMP_FIELDS: Record<string, { created: string; updated?: string }> = {
  project: { created: 'createdAt', updated: 'updatedAt' },
  environment: { created: 'createdAt', updated: 'updatedAt' },
  testSuite: { created: 'createdAt', updated: 'updatedAt' },
  testCase: { created: 'createdAt', updated: 'updatedAt' },
  stepDefinition: { created: 'createdAt', updated: 'updatedAt' },
  pageObject: { created: 'createdAt', updated: 'updatedAt' },
  secret: { created: 'createdAt', updated: 'updatedAt' },
  user: { created: 'createdAt', updated: 'updatedAt' },
  schedule: { created: 'createdAt', updated: 'updatedAt' },
  testRun: { created: 'createdAt' },
  testResult: { created: 'createdAt' },
};
