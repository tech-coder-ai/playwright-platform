import { Injectable, NotFoundException } from '@nestjs/common';
import type { RunArtifactsConfig } from '@playwright-platform/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseRunArtifactsConfig,
  serializeRunArtifactsConfig,
} from '../test-runner/run-artifacts.util';

function mapProject<T extends { runArtifactsConfig?: string }>(project: T) {
  const { runArtifactsConfig, ...rest } = project;
  return {
    ...rest,
    runArtifactsConfig: parseRunArtifactsConfig(runArtifactsConfig),
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project
      .findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { environments: true, testSuites: true } },
        },
      })
      .then((projects) =>
        projects.map(({ _count, ...project }) => ({
          ...mapProject(project),
          environmentCount: _count.environments,
          testSuiteCount: _count.testSuites,
        })),
      );
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: { select: { environments: true, testSuites: true } },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    const { _count, ...rest } = project;
    return {
      ...mapProject(rest),
      environmentCount: _count.environments,
      testSuiteCount: _count.testSuites,
    };
  }

  create(data: { name: string; description?: string }) {
    return this.prisma.project.create({ data }).then(mapProject);
  }

  async update(
    id: string,
    data: { name?: string; description?: string; runArtifactsConfig?: RunArtifactsConfig },
  ) {
    await this.findOne(id);
    return this.prisma.project
      .update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          runArtifactsConfig: data.runArtifactsConfig
            ? serializeRunArtifactsConfig(data.runArtifactsConfig)
            : undefined,
        },
      })
      .then(mapProject);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
