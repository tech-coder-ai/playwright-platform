export interface DashboardSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
}

export interface DashboardTrendPoint {
  date: string;
  passed: number;
  failed: number;
  total: number;
}

export interface DashboardRunTrendPoint {
  runId: string;
  projectId: string;
  projectName: string;
  suiteName?: string;
  status: string;
  passedCount: number;
  failedCount: number;
  createdAt: string;
}

export interface SuiteHealthRow {
  projectId: string;
  projectName: string;
  suiteId: string;
  suiteName: string;
  totalRuns: number;
  passRate: number;
  lastRunStatus?: string;
  lastRunAt?: string;
}

export interface FlakyTestRow {
  projectId: string;
  projectName: string;
  suiteId: string;
  suiteName: string;
  testCaseId: string;
  testCaseName: string;
  executions: number;
  passes: number;
  failures: number;
  failureRate: number;
  statusFlips: number;
  flakyScore: number;
  lastFailureAt?: string;
}

export interface RecentFailureRow {
  runId: string;
  projectId: string;
  projectName: string;
  suiteName?: string;
  testCaseId: string;
  testCaseName: string;
  errorMessage?: string;
  failedAt: string;
  artifactPaths: string[];
}

export interface DashboardData {
  summary: DashboardSummary;
  dailyTrend: DashboardTrendPoint[];
  runTrend: DashboardRunTrendPoint[];
  suiteHealth: SuiteHealthRow[];
  flakyTests: FlakyTestRow[];
  recentFailures: RecentFailureRow[];
}
