import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureProjectExists } from '../common/ensure-exists.util';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string) {
    await ensureProjectExists(this.prisma, projectId);
    return this.prisma.environment.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const environment = await this.prisma.environment.findUnique({ where: { id } });
    if (!environment) {
      throw new NotFoundException(`Environment ${id} not found`);
    }
    return environment;
  }

  async create(projectId: string, data: { name: string; baseUrl: string }) {
    await ensureProjectExists(this.prisma, projectId);
    return this.prisma.environment.create({
      data: { projectId, name: data.name, baseUrl: data.baseUrl },
    });
  }

  async update(id: string, data: { name?: string; baseUrl?: string }) {
    await this.findOne(id);
    return this.prisma.environment.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.environment.delete({ where: { id } });
  }
}
