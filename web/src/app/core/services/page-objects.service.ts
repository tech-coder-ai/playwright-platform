import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PageObject } from '@playwright-platform/shared-types';
import {
  GeneratedPageObjectArtifacts,
  SavePageObjectDto,
  SavedPageObjectResult,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class PageObjectsService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string) {
    return this.http.get<PageObject[]>(`/api/projects/${projectId}/page-objects`);
  }

  getContent(id: string) {
    return this.http.get<{ content: string }>(`/api/page-objects/${id}/content`);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/page-objects/${id}`);
  }

  generate(sessionId: string, body: { screenName: string; componentName?: string }) {
    return this.http.post<GeneratedPageObjectArtifacts>(
      `/api/codegen/sessions/${sessionId}/generate-page-object`,
      body,
    );
  }

  save(projectId: string, dto: SavePageObjectDto) {
    return this.http.post<SavedPageObjectResult>(`/api/projects/${projectId}/page-objects/save`, dto);
  }
}
