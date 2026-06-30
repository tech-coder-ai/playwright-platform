import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import type { AuthConfig, LoginDto, LoginResponse, User } from '@playwright-platform/shared-types';
import { Public } from './auth.decorators';
import { AuthService, RequestUser } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('config')
  getConfig(): AuthConfig {
    return { enabled: this.authService.isAuthEnabled() };
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  async me(@CurrentUser() user: RequestUser | undefined): Promise<User | null> {
    if (!this.authService.isAuthEnabled()) return null;
    if (!user) throw new UnauthorizedException();
    const record = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!record) throw new UnauthorizedException();
    return this.authService.toUser(record);
  }
}
