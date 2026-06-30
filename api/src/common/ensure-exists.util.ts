import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function ensureProjectExists(prisma: PrismaService, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundException(`Project ${projectId} not found`);
  }
  return project;
}

export async function ensureSuiteExists(prisma: PrismaService, suiteId: string) {
  const suite = await prisma.testSuite.findUnique({ where: { id: suiteId } });
  if (!suite) {
    throw new NotFoundException(`Test suite ${suiteId} not found`);
  }
  return suite;
}
