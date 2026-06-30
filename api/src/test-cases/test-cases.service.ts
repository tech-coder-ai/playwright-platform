import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureSuiteExists } from '../common/ensure-exists.util';
import { mapTestCase } from '../common/mappers.util';
import { stringifyJsonArray } from '../common/json-array.util';

@Injectable()
export class TestCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySuite(suiteId: string) {
    await ensureSuiteExists(this.prisma, suiteId);
    const cases = await this.prisma.testCase.findMany({
      where: { suiteId },
      orderBy: { createdAt: 'desc' },
    });
    return cases.map(mapTestCase);
  }

  async findOne(id: string) {
    const testCase = await this.prisma.testCase.findUnique({ where: { id } });
    if (!testCase) {
      throw new NotFoundException(`Test case ${id} not found`);
    }
    return mapTestCase(testCase);
  }

  async create(
    suiteId: string,
    data: {
      name: string;
      type: string;
      filePath: string;
      tags?: string[];
    },
  ) {
    await ensureSuiteExists(this.prisma, suiteId);
    const testCase = await this.prisma.testCase.create({
      data: {
        suiteId,
        name: data.name,
        type: data.type,
        filePath: data.filePath,
        tags: stringifyJsonArray(data.tags),
      },
    });
    return mapTestCase(testCase);
  }

  async update(
    id: string,
    data: {
      name?: string;
      type?: string;
      filePath?: string;
      tags?: string[];
    },
  ) {
    await this.findOne(id);
    const testCase = await this.prisma.testCase.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        filePath: data.filePath,
        tags: data.tags !== undefined ? stringifyJsonArray(data.tags) : undefined,
      },
    });
    return mapTestCase(testCase);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.testCase.delete({ where: { id } });
  }
}
