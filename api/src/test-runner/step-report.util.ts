import type { TestStepDetail } from '@playwright-platform/shared-types';

type CucumberStepResult = {
  status?: string;
  duration?: number;
  error_message?: string;
};

type CucumberStep = {
  keyword?: string;
  name?: string;
  result?: CucumberStepResult;
};

type CucumberElement = {
  type?: string;
  name?: string;
  steps?: CucumberStep[];
};

type CucumberFeatureReport = {
  elements?: CucumberElement[];
};

type PlaywrightStep = {
  title?: string;
  duration?: number;
  error?: { message?: string };
};

type PlaywrightTest = {
  status?: string;
  results?: Array<{
    status?: string;
    duration?: number;
    error?: { message?: string };
    steps?: PlaywrightStep[];
  }>;
};

type PlaywrightSpec = {
  title?: string;
  ok?: boolean;
  tests?: PlaywrightTest[];
};

type PlaywrightSuite = {
  title?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
};

type PlaywrightReport = {
  suites?: PlaywrightSuite[];
};

export function extractStepsFromReport(
  type: string,
  report: unknown,
): TestStepDetail[] {
  if (type === 'gherkin') {
    return extractCucumberSteps(report as CucumberFeatureReport[]);
  }
  return extractPlaywrightSteps(report as PlaywrightReport);
}

function extractCucumberSteps(report: CucumberFeatureReport[]): TestStepDetail[] {
  const steps: TestStepDetail[] = [];
  let order = 0;

  for (const feature of report ?? []) {
    for (const element of feature.elements ?? []) {
      if (element.type && element.type !== 'scenario') continue;
      for (const step of element.steps ?? []) {
        order += 1;
        steps.push({
          order,
          keyword: step.keyword?.trim(),
          name: step.name ?? 'Step',
          status: mapStepStatus(step.result?.status),
          durationMs: step.result?.duration ? Math.round(step.result.duration / 1_000_000) : undefined,
          errorMessage: step.result?.error_message,
        });
      }
    }
  }

  return steps;
}

function extractPlaywrightSteps(report: PlaywrightReport): TestStepDetail[] {
  const steps: TestStepDetail[] = [];
  let order = 0;

  for (const spec of collectSpecs(report.suites ?? [])) {
    for (const test of spec.tests ?? []) {
      const result = test.results?.[0];
      for (const step of result?.steps ?? []) {
        order += 1;
        steps.push({
          order,
          name: step.title ?? spec.title ?? 'Step',
          status: step.error ? 'failed' : 'passed',
          durationMs: step.duration,
          errorMessage: step.error?.message,
        });
      }

      if (!result?.steps?.length) {
        order += 1;
        steps.push({
          order,
          name: spec.title ?? test.status ?? 'Test',
          status: spec.ok === false || result?.status === 'failed' ? 'failed' : 'passed',
          durationMs: result?.duration,
          errorMessage: result?.error?.message,
        });
      }
    }
  }

  return steps;
}

function collectSpecs(suites: PlaywrightSuite[]): PlaywrightSpec[] {
  const specs: PlaywrightSpec[] = [];
  for (const suite of suites) {
    if (suite.specs?.length) specs.push(...suite.specs);
    if (suite.suites?.length) specs.push(...collectSpecs(suite.suites));
  }
  return specs;
}

function mapStepStatus(status?: string): TestStepDetail['status'] {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'undefined':
      return 'failed';
    case 'skipped':
    case 'ambiguous':
      return 'skipped';
    default:
      return 'pending';
  }
}
