import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SecretsService } from './secrets.service';

@Controller()
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Get('projects/:projectId/secrets')
  findByProject(@Param('projectId') projectId: string) {
    return this.secretsService.findByProject(projectId);
  }

  @Get('secrets/:id')
  findOne(@Param('id') id: string) {
    return this.secretsService.findOne(id);
  }

  @Post('projects/:projectId/secrets')
  create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; value: string; environmentId?: string },
  ) {
    return this.secretsService.create(projectId, body);
  }

  @Patch('secrets/:id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; value?: string; environmentId?: string | null },
  ) {
    return this.secretsService.update(id, body);
  }

  @Delete('secrets/:id')
  remove(@Param('id') id: string) {
    return this.secretsService.remove(id);
  }
}
