import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CreateScheduleDto,
  Schedule,
  UpdateScheduleDto,
} from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private readonly http = inject(HttpClient);

  listByProject(projectId: string) {
    return this.http.get<Schedule[]>(`/api/projects/${projectId}/schedules`);
  }

  create(projectId: string, dto: CreateScheduleDto) {
    return this.http.post<Schedule>(`/api/projects/${projectId}/schedules`, dto);
  }

  update(id: string, dto: UpdateScheduleDto) {
    return this.http.patch<Schedule>(`/api/schedules/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/schedules/${id}`);
  }

  runNow(id: string) {
    return this.http.post<{ status: string }>(`/api/schedules/${id}/run-now`, {});
  }
}
