import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ensureProjectExists } from '../common/ensure-exists.util';
import { mapTestSuite } from '../common/mappers.util';
import { stringifyJsonArray } from '../common/json-array.util';

@Injectable()
export class TestSuitesService {
  constructor(private readonly db: DatabaseService) {}

  async findByProject(projectId: string) {
    await ensureProjectExists(this.db, projectId);
    const suites = await this.db.testSuite.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { testCases: true } } },
    });
    return suites.map(({ _count, ...suite }) => ({
      ...mapTestSuite(suite),
      testCaseCount: _count.testCases,
    }));
  }

  async findOne(id: string) {
    const suite = await this.db.testSuite.findUnique({
      where: { id },
      include: { _count: { select: { testCases: true } } },
    });
    if (!suite) {
      throw new NotFoundException(`Test suite ${id} not found`);
    }
    const { _count, ...rest } = suite;
    return { ...mapTestSuite(rest), testCaseCount: _count.testCases };
  }

  async create(
    projectId: string,
    data: { name: string; description?: string; tags?: string[] },
  ) {
    await ensureProjectExists(this.db, projectId);
    const suite = await this.db.testSuite.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        tags: stringifyJsonArray(data.tags),
      },
    });
    return mapTestSuite(suite);
  }

  async update(
    id: string,
    data: { name?: string; description?: string; tags?: string[] },
  ) {
    await this.findOne(id);
    const suite = await this.db.testSuite.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        tags: data.tags !== undefined ? stringifyJsonArray(data.tags) : undefined,
      },
    });
    return mapTestSuite(suite);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.db.testSuite.delete({ where: { id } });
  }
}
