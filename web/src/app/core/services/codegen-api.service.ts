import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  GeneratedTestArtifacts,
  SaveGeneratedTestDto,
  SavedGeneratedTestResult,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class CodegenApiService {
  private readonly http = inject(HttpClient);

  generate(sessionId: string) {
    return this.http.post<GeneratedTestArtifacts>(`/api/codegen/sessions/${sessionId}/generate`, {});
  }

  save(projectId: string, sessionId: string, dto: SaveGeneratedTestDto) {
    return this.http.post<SavedGeneratedTestResult>(
      `/api/projects/${projectId}/codegen/sessions/${sessionId}/save`,
      dto,
    );
  }
}
