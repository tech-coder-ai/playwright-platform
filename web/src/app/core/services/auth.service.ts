import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import type { AuthConfig, LoginDto, LoginResponse, User, UserRole } from '@playwright-platform/shared-types';

const TOKEN_KEY = 'ptp_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly authEnabled = signal(false);
  readonly currentUser = signal<User | null>(null);
  readonly ready = signal(false);

  loadConfig() {
    return this.http.get<AuthConfig>('/api/auth/config').pipe(
      switchMap((config) => {
        this.authEnabled.set(config.enabled);
        if (!config.enabled) return of(null);
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return of(null);
        return this.http.get<User>('/api/auth/me').pipe(
          tap((user) => this.currentUser.set(user)),
          catchError(() => {
            localStorage.removeItem(TOKEN_KEY);
            return of(null);
          }),
        );
      }),
      tap(() => this.ready.set(true)),
    );
  }

  login(dto: LoginDto) {
    return this.http.post<LoginResponse>('/api/auth/login', dto).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.accessToken);
        this.currentUser.set(response.user);
      }),
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  hasMinRole(minRole: UserRole): boolean {
    if (!this.authEnabled()) return true;
    const user = this.currentUser();
    if (!user) return false;
    const rank: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };
    return rank[user.role] >= rank[minRole];
  }

  canEdit(): boolean {
    return this.hasMinRole('editor');
  }
}
