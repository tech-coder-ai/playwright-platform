import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CodegenService } from './codegen.service';
import { CodegenGenerateService } from './codegen-generate.service';
import { CodegenSaveService } from './codegen-save.service';
import type { SaveGeneratedTestDto } from '@playwright-platform/shared-types';

@Controller()
export class CodegenController {
  constructor(
    private readonly codegenService: CodegenService,
    private readonly codegenGenerateService: CodegenGenerateService,
    private readonly codegenSaveService: CodegenSaveService,
  ) {}

  @Get('projects/:projectId/codegen/sessions')
  listByProject(@Param('projectId') projectId: string) {
    return this.codegenService.listByProject(projectId);
  }

  @Get('codegen/sessions/:id')
  getSession(@Param('id') id: string) {
    return this.codegenService.getSession(id);
  }

  @Post('projects/:projectId/codegen/sessions')
  start(
    @Param('projectId') projectId: string,
    @Body()
    body: { url: string; mode?: 'test' | 'page-object'; targetPageObjectId?: string },
  ) {
    return this.codegenService.start(projectId, body.url, {
      mode: body.mode,
      targetPageObjectId: body.targetPageObjectId,
    });
  }

  @Post('codegen/sessions/:id/stop')
  stop(@Param('id') id: string) {
    return this.codegenService.stop(id);
  }

  @Post('codegen/sessions/:id/generate')
  generate(@Param('id') id: string) {
    return this.codegenGenerateService.generate(id);
  }

  @Post('projects/:projectId/codegen/sessions/:id/save')
  save(
    @Param('projectId') projectId: string,
    @Param('id') _sessionId: string,
    @Body() body: SaveGeneratedTestDto,
  ) {
    return this.codegenSaveService.save(projectId, body);
  }
}
