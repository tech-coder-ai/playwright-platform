import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateTestCaseDto,
  TestCase,
  UpdateTestCaseDto,
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

  update(id: string, dto: UpdateTestCaseDto) {
    return this.http.patch<TestCase>(`/api/test-cases/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/test-cases/${id}`);
  }
}
