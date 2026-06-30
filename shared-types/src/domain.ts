export type TestCaseType = 'gherkin' | 'playwright-native';

export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

export type TestResultStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export type TriggerType = 'manual' | 'schedule';

export type { ScheduleNotificationConfig } from './notifications';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary extends Project {
  environmentCount: number;
  testSuiteCount: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentDto {
  name: string;
  baseUrl: string;
}

export interface UpdateEnvironmentDto {
  name?: string;
  baseUrl?: string;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSuiteSummary extends TestSuite {
  testCaseCount: number;
}

export interface CreateTestSuiteDto {
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdateTestSuiteDto {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface TestCase {
  id: string;
  suiteId: string;
  name: string;
  type: TestCaseType;
  filePath: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestCaseDto {
  name: string;
  type: TestCaseType;
  filePath: string;
  tags?: string[];
}

export interface UpdateTestCaseDto {
  name?: string;
  type?: TestCaseType;
  filePath?: string;
  tags?: string[];
}

export interface TestCaseSource {
  testCaseId: string;
  type: TestCaseType;
  paths: {
    featurePath?: string;
    stepDefinitionsPath?: string;
    pageObjectPath?: string;
    specPath?: string;
  };
  featureFile?: string;
  stepDefinitions?: string;
  pageObject?: string;
  specFile?: string;
}

export interface UpdateTestCaseSourceDto {
  featureFile?: string;
  stepDefinitions?: string;
  pageObject?: string;
  specFile?: string;
}

export interface StepDefinition {
  id: string;
  projectId: string;
  pattern: string;
  helperFunction: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageObject {
  id: string;
  projectId: string;
  name: string;
  screenName: string;
  version: number;
  classFilePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretMeta {
  id: string;
  projectId: string;
  environmentId?: string;
  environmentName?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSecretDto {
  name: string;
  value: string;
  environmentId?: string;
}

export interface UpdateSecretDto {
  name?: string;
  value?: string;
  environmentId?: string | null;
}

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  suiteIds: string[];
  environmentId?: string;
  environmentName?: string;
  enabled: boolean;
  notificationConfig?: import('./notifications').ScheduleNotificationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleDto {
  name: string;
  cronExpression: string;
  suiteIds: string[];
  environmentId?: string;
  enabled?: boolean;
  notificationConfig?: import('./notifications').ScheduleNotificationConfig;
}

export interface UpdateScheduleDto {
  name?: string;
  cronExpression?: string;
  suiteIds?: string[];
  environmentId?: string | null;
  enabled?: boolean;
  notificationConfig?: import('./notifications').ScheduleNotificationConfig | null;
}

export interface TestRun {
  id: string;
  projectId: string;
  suiteId?: string;
  suiteName?: string;
  environmentId?: string;
  environmentName?: string;
  status: TestRunStatus;
  triggeredBy: TriggerType;
  /** When true, tests run with a visible browser window (local API server only). */
  headed?: boolean;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface TestRunSummary extends TestRun {
  resultCount: number;
}

export interface TestResultDetail extends TestResult {
  testCaseName: string;
  testCaseFilePath: string;
  testCaseType: TestCaseType;
}

export interface TestRunDetail extends TestRun {
  testResults: TestResultDetail[];
}

export interface TriggerTestRunDto {
  environmentId?: string;
  headed?: boolean;
}

export interface TestResult {
  id: string;
  runId: string;
  testCaseId: string;
  status: TestResultStatus;
  durationMs?: number;
  errorMessage?: string;
  artifactPaths: string[];
  createdAt: string;
}
