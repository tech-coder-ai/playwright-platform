import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, RequestUser } from './auth.service';
import { IS_PUBLIC_KEY } from './auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!this.authService.isAuthEnabled()) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser; headers: Record<string, string> }>();
    const header = request.headers['authorization'] ?? request.headers['Authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = header.slice('Bearer '.length).trim();
    request.user = this.authService.verifyToken(token);
    return true;
  }
}
