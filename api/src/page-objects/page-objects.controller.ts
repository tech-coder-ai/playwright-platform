import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PageObjectsService } from './page-objects.service';
import { PageObjectGenerateService } from './page-object-generate.service';
import { PageObjectSaveService } from './page-object-save.service';
import type { SavePageObjectDto } from '@playwright-platform/shared-types';

@Controller()
export class PageObjectsController {
  constructor(
    private readonly pageObjectsService: PageObjectsService,
    private readonly pageObjectGenerateService: PageObjectGenerateService,
    private readonly pageObjectSaveService: PageObjectSaveService,
  ) {}

  @Get('projects/:projectId/page-objects')
  findByProject(@Param('projectId') projectId: string) {
    return this.pageObjectsService.findByProject(projectId);
  }

  @Get('page-objects/:id')
  findOne(@Param('id') id: string) {
    return this.pageObjectsService.findOne(id);
  }

  @Get('page-objects/:id/content')
  getContent(@Param('id') id: string) {
    return this.pageObjectsService.readContent(id).then((content) => ({ content }));
  }

  @Delete('page-objects/:id')
  remove(@Param('id') id: string) {
    return this.pageObjectsService.remove(id);
  }

  @Post('codegen/sessions/:sessionId/generate-page-object')
  generate(
    @Param('sessionId') sessionId: string,
    @Body() body: { screenName: string; componentName?: string },
  ) {
    return this.pageObjectGenerateService.generate(sessionId, body);
  }

  @Post('projects/:projectId/page-objects/save')
  save(@Param('projectId') projectId: string, @Body() body: SavePageObjectDto) {
    return this.pageObjectSaveService.save(projectId, body);
  }
}
