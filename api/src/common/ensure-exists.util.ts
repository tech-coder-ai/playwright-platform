import { NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export async function ensureProjectExists(db: DatabaseService, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundException(`Project ${projectId} not found`);
  }
  return project;
}

export async function ensureSuiteExists(db: DatabaseService, suiteId: string) {
  const suite = await db.testSuite.findUnique({ where: { id: suiteId } });
  if (!suite) {
    throw new NotFoundException(`Test suite ${suiteId} not found`);
  }
  return suite;
}
