import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@playwright-platform/shared-types';
import { AuthService, RequestUser } from './auth.service';
import { IS_PUBLIC_KEY, ROLES_KEY, hasMinRole } from './auth.decorators';

const METHOD_MIN_ROLE: Record<string, UserRole> = {
  GET: 'viewer',
  HEAD: 'viewer',
  POST: 'editor',
  PUT: 'editor',
  PATCH: 'editor',
  DELETE: 'editor',
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.authService.isAuthEnabled()) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const explicitRole = this.reflector.getAllAndOverride<UserRole | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{ user?: RequestUser; method: string }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const minRole = explicitRole ?? METHOD_MIN_ROLE[request.method] ?? 'editor';
    if (!hasMinRole(user.role, minRole)) {
      throw new ForbiddenException(`Requires ${minRole} role or higher`);
    }
    return true;
  }
}
