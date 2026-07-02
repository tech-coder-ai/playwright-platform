import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ensureProjectExists } from '../common/ensure-exists.util';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly db: DatabaseService) {}

  async findByProject(projectId: string) {
    await ensureProjectExists(this.db, projectId);
    return this.db.environment.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const environment = await this.db.environment.findUnique({ where: { id } });
    if (!environment) {
      throw new NotFoundException(`Environment ${id} not found`);
    }
    return environment;
  }

  async create(projectId: string, data: { name: string; baseUrl: string }) {
    await ensureProjectExists(this.db, projectId);
    return this.db.environment.create({
      data: { projectId, name: data.name, baseUrl: data.baseUrl },
    });
  }

  async update(id: string, data: { name?: string; baseUrl?: string }) {
    await this.findOne(id);
    return this.db.environment.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.db.environment.delete({ where: { id } });
  }
}
