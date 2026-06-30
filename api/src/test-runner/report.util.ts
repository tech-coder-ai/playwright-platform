import { parseJsonArray, stringifyJsonArray } from '../common/json-array.util';

type ReportSpec = {
  ok?: boolean;
  tests?: Array<{ status?: string; results?: Array<{ status?: string; error?: { message?: string } }> }>;
  errors?: Array<{ message?: string }>;
};

type ReportSuite = {
  file?: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
};

type PlaywrightReport = {
  suites?: ReportSuite[];
  errors?: Array<{ message?: string }>;
};

export function parsePlaywrightReport(report: PlaywrightReport): {
  passed: boolean;
  errorMessage?: string;
} {
  const specs = collectSpecs(report.suites ?? []);
  if (specs.length === 0) {
    const topError = report.errors?.[0]?.message;
    return { passed: false, errorMessage: topError ?? 'No tests found in report' };
  }

  const failed = specs.find((spec) => !spec.ok);
  if (failed) {
    const message =
      failed.errors?.[0]?.message ??
      failed.tests?.flatMap((t) => t.results ?? []).find((r) => r.error)?.error?.message ??
      'Test failed';
    return { passed: false, errorMessage: message };
  }

  return { passed: true };
}

function collectSpecs(suites: ReportSuite[]): ReportSpec[] {
  const specs: ReportSpec[] = [];
  for (const suite of suites) {
    if (suite.specs?.length) specs.push(...suite.specs);
    if (suite.suites?.length) specs.push(...collectSpecs(suite.suites));
  }
  return specs;
}

export function mergeArtifactPaths(existing: string, added: string[]): string {
  const current = parseJsonArray(existing);
  const merged = [...new Set([...current, ...added])];
  return stringifyJsonArray(merged);
}
