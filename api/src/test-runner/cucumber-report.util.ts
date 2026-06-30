export interface CucumberStepResult {
  status?: string;
  error_message?: string;
}

export interface CucumberStep {
  result?: CucumberStepResult;
}

export interface CucumberElement {
  type?: string;
  steps?: CucumberStep[];
}

export interface CucumberFeatureReport {
  elements?: CucumberElement[];
}

export function parseCucumberReport(report: CucumberFeatureReport[]): {
  passed: boolean;
  errorMessage?: string;
} {
  if (!Array.isArray(report) || report.length === 0) {
    return { passed: false, errorMessage: 'No scenarios found in Cucumber report' };
  }

  for (const feature of report) {
    for (const element of feature.elements ?? []) {
      if (element.type && element.type !== 'scenario') continue;
      for (const step of element.steps ?? []) {
        const status = step.result?.status;
        if (status === 'failed' || status === 'undefined') {
          return {
            passed: false,
            errorMessage: step.result?.error_message ?? `Step ${status ?? 'failed'}`,
          };
        }
      }
    }
  }

  return { passed: true };
}
