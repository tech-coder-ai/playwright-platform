import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateProjectDto,
  Project,
  ProjectSummary,
  UpdateProjectDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<ProjectSummary[]>('/api/projects');
  }

  get(id: string) {
    return this.http.get<ProjectSummary>(`/api/projects/${id}`);
  }

  create(dto: CreateProjectDto) {
    return this.http.post<Project>('/api/projects', dto);
  }

  update(id: string, dto: UpdateProjectDto) {
    return this.http.patch<Project>(`/api/projects/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/projects/${id}`);
  }
}
