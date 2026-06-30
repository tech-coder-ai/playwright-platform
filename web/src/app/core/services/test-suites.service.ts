import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateTestSuiteDto,
  TestSuite,
  TestSuiteSummary,
  UpdateTestSuiteDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class TestSuitesService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string) {
    return this.http.get<TestSuiteSummary[]>(`/api/projects/${projectId}/test-suites`);
  }

  get(id: string) {
    return this.http.get<TestSuiteSummary>(`/api/test-suites/${id}`);
  }

  create(projectId: string, dto: CreateTestSuiteDto) {
    return this.http.post<TestSuite>(`/api/projects/${projectId}/test-suites`, dto);
  }

  update(id: string, dto: UpdateTestSuiteDto) {
    return this.http.patch<TestSuite>(`/api/test-suites/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/test-suites/${id}`);
  }
}
