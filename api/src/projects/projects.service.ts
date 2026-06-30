import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { environments: true, testSuites: true } },
      },
    }).then((projects) =>
      projects.map(({ _count, ...project }) => ({
        ...project,
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
      ...rest,
      environmentCount: _count.environments,
      testSuiteCount: _count.testSuites,
    };
  }

  create(data: { name: string; description?: string }) {
    return this.prisma.project.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    await this.findOne(id);
    return this.prisma.project.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
