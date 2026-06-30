import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateEnvironmentDto,
  Environment,
  UpdateEnvironmentDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class EnvironmentsService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string) {
    return this.http.get<Environment[]>(`/api/projects/${projectId}/environments`);
  }

  create(projectId: string, dto: CreateEnvironmentDto) {
    return this.http.post<Environment>(`/api/projects/${projectId}/environments`, dto);
  }

  update(id: string, dto: UpdateEnvironmentDto) {
    return this.http.patch<Environment>(`/api/environments/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/environments/${id}`);
  }
}
