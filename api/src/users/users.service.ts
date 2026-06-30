import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateUserDto, UpdateUserDto, User } from '@playwright-platform/shared-types';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  findAll(): Promise<User[]> {
    return this.prisma.user
      .findMany({ orderBy: { createdAt: 'asc' } })
      .then((users) => users.map((user) => this.authService.toUser(user)));
  }

  async create(data: CreateUserDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    return this.authService.createUser(data.email, data.password, data.role);
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (data.email) {
      const normalized = data.email.trim().toLowerCase();
      const conflict = await this.prisma.user.findFirst({
        where: { email: normalized, NOT: { id } },
      });
      if (conflict) {
        throw new BadRequestException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: data.email?.trim().toLowerCase(),
        role: data.role,
        passwordHash: data.password ? await bcrypt.hash(data.password, 10) : undefined,
      },
    });
    return this.authService.toUser(user);
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }
    const count = await this.prisma.user.count();
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last user');
    }
    await this.prisma.user.delete({ where: { id } });
  }
}
