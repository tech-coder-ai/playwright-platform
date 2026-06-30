import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  generateFromCodegen,
  validateGeneratedArtifacts,
} from '@playwright-platform/codegen-engine';
import { requireOpenAiApiKey } from '../common/llm-config.util';
import { CodegenService } from './codegen.service';
import type { GeneratedTestArtifacts } from '@playwright-platform/shared-types';

@Injectable()
export class CodegenGenerateService {
  private readonly logger = new Logger(CodegenGenerateService.name);

  constructor(private readonly codegenService: CodegenService) {}

  async generate(sessionId: string): Promise<GeneratedTestArtifacts> {
    const session = this.codegenService.getSession(sessionId);
    const recording = session.content.trim();

    if (!recording) {
      throw new BadRequestException('Recording is empty — record actions before generating');
    }

    const apiKey = requireOpenAiApiKey();

    this.logger.log(`Generating tests from session ${sessionId}`);

    return generateFromCodegen({
      codegenOutput: recording,
      targetUrl: session.url,
      apiKey,
    });
  }

  validateForSave(artifacts: {
    featureFile: string;
    stepDefinitions: string;
    pageObject: string;
  }) {
    try {
      validateGeneratedArtifacts(artifacts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      throw new BadRequestException(message);
    }
  }
}
