import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { TestCaseSource, UpdateTestCaseSourceDto } from '@playwright-platform/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeGeneratedContent } from '../common/normalize-generated-content.util';
import { getTestsRoot } from '../test-runner/paths.util';
import { resolveGherkinPaths } from '../test-runner/test-case-paths.util';
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

  async getSource(id: string): Promise<TestCaseSource> {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
      include: { suite: { select: { projectId: true } } },
    });
    if (!testCase) {
      throw new NotFoundException(`Test case ${id} not found`);
    }

    const testsRoot = getTestsRoot();

    if (testCase.type === 'gherkin') {
      const paths = resolveGherkinPaths(testCase.filePath);
      const [featureFile, stepDefinitions, pageObject] = await Promise.all([
        readTestFile(testsRoot, paths.featurePath),
        readTestFile(testsRoot, paths.stepDefinitionsPath),
        readTestFile(testsRoot, paths.pageObjectPath),
      ]);

      return {
        testCaseId: testCase.id,
        type: 'gherkin',
        paths: {
          featurePath: paths.featurePath,
          stepDefinitionsPath: paths.stepDefinitionsPath,
          pageObjectPath: paths.pageObjectPath,
        },
        featureFile,
        stepDefinitions,
        pageObject,
      };
    }

    const specPath = testCase.filePath.replace(/\\/g, '/');
    const specFile = await readTestFile(testsRoot, specPath);

    return {
      testCaseId: testCase.id,
      type: 'playwright-native',
      paths: { specPath },
      specFile,
    };
  }

  async updateSource(id: string, dto: UpdateTestCaseSourceDto): Promise<TestCaseSource> {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
      include: { suite: { select: { projectId: true } } },
    });
    if (!testCase) {
      throw new NotFoundException(`Test case ${id} not found`);
    }

    const testsRoot = getTestsRoot();

    if (testCase.type === 'gherkin') {
      if (!dto.featureFile?.trim() || !dto.stepDefinitions?.trim() || !dto.pageObject?.trim()) {
        throw new BadRequestException(
          'featureFile, stepDefinitions, and pageObject are required for Gherkin tests',
        );
      }

      const paths = resolveGherkinPaths(testCase.filePath);
      await Promise.all([
        writeTestFile(testsRoot, paths.featurePath, dto.featureFile),
        writeTestFile(testsRoot, paths.stepDefinitionsPath, dto.stepDefinitions),
        writeTestFile(testsRoot, paths.pageObjectPath, dto.pageObject),
      ]);

      const pageObject = await this.prisma.pageObject.findFirst({
        where: {
          projectId: testCase.suite.projectId,
          classFilePath: paths.pageObjectPath,
        },
      });
      if (pageObject) {
        await this.prisma.pageObject.update({
          where: { id: pageObject.id },
          data: { version: pageObject.version + 1 },
        });
      }

      await this.prisma.testCase.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return this.getSource(id);
    }

    if (!dto.specFile?.trim()) {
      throw new BadRequestException('specFile is required for Playwright native tests');
    }

    const specPath = testCase.filePath.replace(/\\/g, '/');
    await writeTestFile(testsRoot, specPath, dto.specFile);

    await this.prisma.testCase.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return this.getSource(id);
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

async function readTestFile(testsRoot: string, relativePath: string): Promise<string> {
  const fullPath = path.join(testsRoot, relativePath);
  try {
    return await fs.readFile(fullPath, 'utf8');
  } catch {
    throw new NotFoundException(`Test file not found: ${relativePath}`);
  }
}

async function writeTestFile(
  testsRoot: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = path.join(testsRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, normalizeGeneratedContent(content), 'utf8');
}
