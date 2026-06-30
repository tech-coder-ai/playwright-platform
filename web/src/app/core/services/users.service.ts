import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { CreateUserDto, User } from '@playwright-platform/shared-types';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<User[]>('/api/users');
  }

  create(dto: CreateUserDto) {
    return this.http.post<User>('/api/users', dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
