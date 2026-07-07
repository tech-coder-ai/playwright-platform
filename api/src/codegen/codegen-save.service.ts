import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { getTestsRoot } from '../test-runner/paths.util';
import { normalizeGeneratedContent } from '../common/normalize-generated-content.util';
import { CodegenGenerateService } from './codegen-generate.service';
import type { SaveGeneratedTestDto, SavedGeneratedTestResult } from '@playwright-platform/shared-types';

@Injectable()
export class CodegenSaveService {
  constructor(
    private readonly db: DatabaseService,
    private readonly generateService: CodegenGenerateService,
  ) {}

  async save(projectId: string, dto: SaveGeneratedTestDto): Promise<SavedGeneratedTestResult> {
    this.generateService.validateForSave(dto);

    const suite = await this.db.testSuite.findFirst({
      where: { id: dto.suiteId, projectId },
    });
    if (!suite) {
      throw new NotFoundException('Test suite not found in this project');
    }

    const slug = slugify(dto.testCaseName);
    if (!slug) {
      throw new BadRequestException('Test case name must contain alphanumeric characters');
    }

    const featurePath = path.join('features', `${slug}.feature`);
    const stepDefinitionsPath = path.join('steps', `${slug}.steps.ts`);
    const pageObjectPath = path.join('page-objects', `${slug}.page.ts`);

    const testsRoot = getTestsRoot();
    await fs.mkdir(path.join(testsRoot, 'features'), { recursive: true });
    await fs.mkdir(path.join(testsRoot, 'steps'), { recursive: true });
    await fs.mkdir(path.join(testsRoot, 'page-objects'), { recursive: true });

    await fs.writeFile(
      path.join(testsRoot, featurePath),
      normalizeGeneratedContent(dto.featureFile),
      'utf8',
    );
    await fs.writeFile(
      path.join(testsRoot, stepDefinitionsPath),
      rewritePageObjectImport(normalizeGeneratedContent(dto.stepDefinitions), slug),
      'utf8',
    );
    await fs.writeFile(
      path.join(testsRoot, pageObjectPath),
      normalizeGeneratedContent(dto.pageObject),
      'utf8',
    );

    const testCase = await this.db.testCase.create({
      data: {
        suiteId: dto.suiteId,
        name: dto.testCaseName.trim(),
        type: 'gherkin',
        filePath: featurePath.replace(/\\/g, '/'),
        tags: '[]',
      },
    });

    const pageObject = await this.db.pageObject.create({
      data: {
        projectId,
        name: `${slug}Page`,
        screenName: dto.screenName.trim() || dto.testCaseName.trim(),
        classFilePath: pageObjectPath.replace(/\\/g, '/'),
      },
    });

    return {
      testCaseId: testCase.id,
      pageObjectId: pageObject.id,
      featurePath: featurePath.replace(/\\/g, '/'),
      stepDefinitionsPath: stepDefinitionsPath.replace(/\\/g, '/'),
      pageObjectPath: pageObjectPath.replace(/\\/g, '/'),
    };
  }
}

/**
 * The generated step file imports the page object from a placeholder path
 * (the LLM cannot know the final filename, which is derived from the test
 * case name at save time). Point every ../page-objects/* import at the file
 * actually written next to it.
 */
function rewritePageObjectImport(stepDefinitions: string, slug: string): string {
  return stepDefinitions.replace(
    /(from\s*['"])\.\.?\/page-objects\/[^'"]+(['"])/g,
    `$1../page-objects/${slug}.page$2`,
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
