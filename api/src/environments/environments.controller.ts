import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';

@Controller()
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Get('projects/:projectId/environments')
  findByProject(@Param('projectId') projectId: string) {
    return this.environmentsService.findByProject(projectId);
  }

  @Get('environments/:id')
  findOne(@Param('id') id: string) {
    return this.environmentsService.findOne(id);
  }

  @Post('projects/:projectId/environments')
  create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; baseUrl: string },
  ) {
    return this.environmentsService.create(projectId, body);
  }

  @Patch('environments/:id')
  update(@Param('id') id: string, @Body() body: { name?: string; baseUrl?: string }) {
    return this.environmentsService.update(id, body);
  }

  @Delete('environments/:id')
  remove(@Param('id') id: string) {
    return this.environmentsService.remove(id);
  }
}
