import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { LoginResponse, User, UserRole } from '@playwright-platform/shared-types';
import { DatabaseService } from '../database/database.service';

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    if (!this.isAuthEnabled()) {
      this.logger.log('Auth disabled (AUTH_ENABLED=false)');
      return;
    }

    const count = await this.db.user.count();
    if (count > 0) return;

    const email = process.env['ADMIN_EMAIL'];
    const password = process.env['ADMIN_PASSWORD'];
    if (!email || !password) {
      this.logger.warn(
        'Auth enabled but no users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap an admin account.',
      );
      return;
    }

    await this.createUser(email, password, 'admin');
    this.logger.log(`Bootstrapped admin user ${email}`);
  }

  isAuthEnabled(): boolean {
    return process.env['AUTH_ENABLED'] === 'true';
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: this.signToken(user),
      user: this.toUser(user),
    };
  }

  verifyToken(token: string): RequestUser {
    const secret = this.getJwtSecret();
    try {
      const payload = jwt.verify(token, secret) as { sub: string; email: string; role: UserRole };
      return { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async createUser(email: string, password: string, role: UserRole): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.db.user.create({
      data: { email: normalizedEmail, passwordHash, role },
    });
    return this.toUser(user);
  }

  toUser(user: { id: string; email: string; role: string; createdAt: Date; updatedAt: Date }): User {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private signToken(user: { id: string; email: string; role: string }): string {
    return jwt.sign(
      { email: user.email, role: user.role },
      this.getJwtSecret(),
      { subject: user.id, expiresIn: '7d' },
    );
  }

  private getJwtSecret(): string {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      throw new Error('JWT_SECRET is required when AUTH_ENABLED=true');
    }
    return secret;
  }
}
