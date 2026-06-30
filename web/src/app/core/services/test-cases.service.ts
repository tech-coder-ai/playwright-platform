import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateTestCaseDto,
  TestCase,
  TestCaseSource,
  UpdateTestCaseDto,
  UpdateTestCaseSourceDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class TestCasesService {
  private readonly http = inject(HttpClient);

  listBySuite(suiteId: string) {
    return this.http.get<TestCase[]>(`/api/test-suites/${suiteId}/test-cases`);
  }

  create(suiteId: string, dto: CreateTestCaseDto) {
    return this.http.post<TestCase>(`/api/test-suites/${suiteId}/test-cases`, dto);
  }

  get(id: string) {
    return this.http.get<TestCase>(`/api/test-cases/${id}`);
  }

  getSource(id: string) {
    return this.http.get<TestCaseSource>(`/api/test-cases/${id}/source`);
  }

  updateSource(id: string, dto: UpdateTestCaseSourceDto) {
    return this.http.put<TestCaseSource>(`/api/test-cases/${id}/source`, dto);
  }

  update(id: string, dto: UpdateTestCaseDto) {
    return this.http.patch<TestCase>(`/api/test-cases/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/test-cases/${id}`);
  }
}
