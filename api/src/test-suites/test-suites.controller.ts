import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TestSuitesService } from './test-suites.service';

@Controller()
export class TestSuitesController {
  constructor(private readonly testSuitesService: TestSuitesService) {}

  @Get('projects/:projectId/test-suites')
  findByProject(@Param('projectId') projectId: string) {
    return this.testSuitesService.findByProject(projectId);
  }

  @Get('test-suites/:id')
  findOne(@Param('id') id: string) {
    return this.testSuitesService.findOne(id);
  }

  @Post('projects/:projectId/test-suites')
  create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; description?: string; tags?: string[] },
  ) {
    return this.testSuitesService.create(projectId, body);
  }

  @Patch('test-suites/:id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; tags?: string[] },
  ) {
    return this.testSuitesService.update(id, body);
  }

  @Delete('test-suites/:id')
  remove(@Param('id') id: string) {
    return this.testSuitesService.remove(id);
  }
}
