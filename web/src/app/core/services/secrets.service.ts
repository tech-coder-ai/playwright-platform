import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateSecretDto,
  SecretMeta,
  UpdateSecretDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class SecretsService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string) {
    return this.http.get<SecretMeta[]>(`/api/projects/${projectId}/secrets`);
  }

  create(projectId: string, dto: CreateSecretDto) {
    return this.http.post<SecretMeta>(`/api/projects/${projectId}/secrets`, dto);
  }

  update(id: string, dto: UpdateSecretDto) {
    return this.http.patch<SecretMeta>(`/api/secrets/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/secrets/${id}`);
  }
}
