import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DashboardData } from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  get(projectId?: string, runLimit = 20) {
    let params = new HttpParams().set('runLimit', runLimit);
    if (projectId) params = params.set('projectId', projectId);
    return this.http.get<DashboardData>('/api/dashboard', { params });
  }
}
