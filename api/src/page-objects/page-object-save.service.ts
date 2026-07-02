import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { getTestsRoot } from '../test-runner/paths.util';
import { normalizeGeneratedContent } from '../common/normalize-generated-content.util';
import { PageObjectGenerateService } from './page-object-generate.service';
import type { SavePageObjectDto, SavedPageObjectResult } from '@playwright-platform/shared-types';

@Injectable()
export class PageObjectSaveService {
  constructor(
    private readonly db: DatabaseService,
    private readonly generateService: PageObjectGenerateService,
  ) {}

  async save(projectId: string, dto: SavePageObjectDto): Promise<SavedPageObjectResult> {
    this.generateService.validateForSave(dto.pageObject, dto.name);

    const testsRoot = getTestsRoot();
    await fs.mkdir(path.join(testsRoot, 'page-objects'), { recursive: true });

    if (dto.existingPageObjectId) {
      const existing = await this.db.pageObject.findFirst({
        where: { id: dto.existingPageObjectId, projectId },
      });
      if (!existing) {
        throw new NotFoundException('Page object not found in this project');
      }

      const fullPath = path.join(testsRoot, existing.classFilePath);
      await fs.writeFile(fullPath, normalizeGeneratedContent(dto.pageObject), 'utf8');

      const updated = await this.db.pageObject.update({
        where: { id: existing.id },
        data: {
          name: dto.name.trim(),
          screenName: dto.screenName.trim(),
          version: existing.version + 1,
        },
      });

      return {
        pageObjectId: updated.id,
        classFilePath: updated.classFilePath,
        version: updated.version,
        patched: true,
      };
    }

    const slug = slugify(dto.name);
    if (!slug) {
      throw new BadRequestException('Page object name must contain alphanumeric characters');
    }

    const classFilePath = path.join('page-objects', `${slug}.page.ts`).replace(/\\/g, '/');
    await fs.writeFile(path.join(testsRoot, classFilePath), normalizeGeneratedContent(dto.pageObject), 'utf8');

    const created = await this.db.pageObject.create({
      data: {
        projectId,
        name: dto.name.trim(),
        screenName: dto.screenName.trim(),
        classFilePath,
        version: 1,
      },
    });

    return {
      pageObjectId: created.id,
      classFilePath: created.classFilePath,
      version: created.version,
      patched: false,
    };
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/Page$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
