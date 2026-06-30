import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  TestRunDetail,
  TestRunSummary,
  TriggerTestRunDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class TestRunsService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string) {
    return this.http.get<TestRunSummary[]>(`/api/projects/${projectId}/test-runs`);
  }

  get(id: string) {
    return this.http.get<TestRunDetail>(`/api/test-runs/${id}`);
  }

  getLog(id: string) {
    return this.http.get(`/api/test-runs/${id}/log`, { responseType: 'text' });
  }

  getResultLog(resultId: string) {
    return this.http.get(`/api/test-results/${resultId}/log`, { responseType: 'text' });
  }

  triggerSuiteRun(suiteId: string, dto: TriggerTestRunDto = {}) {
    return this.http.post<TestRunDetail>(`/api/test-suites/${suiteId}/test-runs`, dto);
  }

  artifactUrl(runId: string, artifactPath: string): string {
    return `/api/test-runs/${runId}/artifacts?path=${encodeURIComponent(artifactPath)}`;
  }
}
