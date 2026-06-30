import { parseJsonArray } from '../common/json-array.util';

type RunRecord = {
  id: string;
  projectId: string;
  suiteId: string | null;
  environmentId: string | null;
  status: string;
  triggeredBy: string;
  headed: boolean;
  logPath: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  suite: { name: string } | null;
  environment: { name: string } | null;
  testResults: Array<{
    id: string;
    runId: string;
    testCaseId: string;
    status: string;
    durationMs: number | null;
    errorMessage: string | null;
    artifactPaths: string;
    createdAt: Date;
    testCase: { name: string; filePath: string; type: string };
  }>;
};

export function toTestRunDetail(run: RunRecord) {
  return {
    id: run.id,
    projectId: run.projectId,
    suiteId: run.suiteId ?? undefined,
    suiteName: run.suite?.name,
    environmentId: run.environmentId ?? undefined,
    environmentName: run.environment?.name,
    status: run.status,
    triggeredBy: run.triggeredBy,
    headed: run.headed,
    logPath: run.logPath ?? undefined,
    startedAt: run.startedAt?.toISOString(),
    endedAt: run.endedAt?.toISOString(),
    createdAt: run.createdAt.toISOString(),
    testResults: run.testResults.map((result) => ({
      id: result.id,
      runId: result.runId,
      testCaseId: result.testCaseId,
      testCaseName: result.testCase.name,
      testCaseFilePath: result.testCase.filePath,
      testCaseType: result.testCase.type,
      status: result.status,
      durationMs: result.durationMs ?? undefined,
      errorMessage: result.errorMessage ?? undefined,
      artifactPaths: parseJsonArray(result.artifactPaths),
      createdAt: result.createdAt.toISOString(),
    })),
  };
}
