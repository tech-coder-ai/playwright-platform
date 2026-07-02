import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { ensureProjectExists } from '../common/ensure-exists.util';
import { getTestsRoot } from '../test-runner/paths.util';

@Injectable()
export class PageObjectsService {
  constructor(private readonly db: DatabaseService) {}

  async findByProject(projectId: string) {
    await ensureProjectExists(this.db, projectId);
    const pageObjects = await this.db.pageObject.findMany({
      where: { projectId },
      orderBy: [{ screenName: 'asc' }, { version: 'desc' }],
    });
    return pageObjects.map((po) => ({
      ...po,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
    }));
  }

  async findOne(id: string) {
    const pageObject = await this.db.pageObject.findUnique({ where: { id } });
    if (!pageObject) {
      throw new NotFoundException(`Page object ${id} not found`);
    }
    return {
      ...pageObject,
      createdAt: pageObject.createdAt.toISOString(),
      updatedAt: pageObject.updatedAt.toISOString(),
    };
  }

  async readContent(id: string): Promise<string> {
    const pageObject = await this.db.pageObject.findUnique({ where: { id } });
    if (!pageObject) {
      throw new NotFoundException(`Page object ${id} not found`);
    }
    const fullPath = path.join(getTestsRoot(), pageObject.classFilePath);
    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch {
      throw new NotFoundException('Page object file not found on disk');
    }
  }

  async remove(id: string) {
    const pageObject = await this.findOne(id);
    const fullPath = path.join(getTestsRoot(), pageObject.classFilePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // File may already be missing.
    }
    return this.db.pageObject.delete({ where: { id } });
  }
}
