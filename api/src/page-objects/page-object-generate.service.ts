import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  generatePageObjectFromCodegen,
  validatePageObject,
} from '@playwright-platform/codegen-engine';
import { requireLlmApiKey } from '../common/llm-config.util';
import { CodegenService } from '../codegen/codegen.service';
import { PageObjectsService } from './page-objects.service';
import type { GeneratedPageObjectArtifacts } from '@playwright-platform/shared-types';

@Injectable()
export class PageObjectGenerateService {
  private readonly logger = new Logger(PageObjectGenerateService.name);

  constructor(
    private readonly codegenService: CodegenService,
    private readonly pageObjectsService: PageObjectsService,
  ) {}

  async generate(
    sessionId: string,
    options: { screenName: string; componentName?: string },
  ): Promise<GeneratedPageObjectArtifacts> {
    const session = this.codegenService.getSession(sessionId);
    const recording = session.content.trim();

    if (!recording) {
      throw new BadRequestException('Recording is empty — record actions before generating');
    }

    const apiKey = requireLlmApiKey();

    let existingPageObject: string | undefined;
    if (session.targetPageObjectId) {
      existingPageObject = await this.pageObjectsService.readContent(session.targetPageObjectId);
    }

    this.logger.log(`Generating page object from session ${sessionId}`);

    return generatePageObjectFromCodegen({
      codegenOutput: recording,
      targetUrl: session.url,
      screenName: options.screenName,
      componentName: options.componentName,
      existingPageObject,
      apiKey,
    });
  }

  validateForSave(pageObject: string, className: string) {
    try {
      validatePageObject(pageObject, className);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      throw new BadRequestException(message);
    }
  }
}
