import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';
import { TestRunsService } from './test-runs.service';

@Controller()
export class TestRunsController {
  constructor(private readonly testRunsService: TestRunsService) {}

  @Get('projects/:projectId/test-runs')
  findByProject(@Param('projectId') projectId: string) {
    return this.testRunsService.findByProject(projectId);
  }

  @Get('test-runs/:id')
  findOne(@Param('id') id: string) {
    return this.testRunsService.findOne(id);
  }

  @Get('test-runs/:id/log')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async getLog(@Param('id') id: string) {
    const log = await this.testRunsService.getLog(id);
    if (log === null) {
      throw new NotFoundException('Log not available yet');
    }
    return log;
  }

  @Get('test-runs/:id/artifacts')
  async getArtifact(
    @Param('id') id: string,
    @Query('path') relativePath: string,
    @Res() res: Response,
  ) {
    if (!relativePath) {
      throw new NotFoundException('Artifact path is required');
    }
    const buffer = await this.testRunsService.getArtifact(id, relativePath);
    res.setHeader('Content-Type', contentTypeFor(relativePath));
    res.send(buffer);
  }

  @Post('test-suites/:suiteId/test-runs')
  triggerSuiteRun(
    @Param('suiteId') suiteId: string,
    @Body() body: { environmentId?: string; headed?: boolean },
  ) {
    return this.testRunsService.triggerSuiteRun(suiteId, {
      environmentId: body.environmentId,
      headed: body.headed ?? false,
      triggeredBy: 'manual',
    });
  }

  @Get('test-runner/queue')
  queueStats() {
    return this.testRunsService.getQueueStats();
  }
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webm':
      return 'video/webm';
    case '.zip':
      return 'application/zip';
    case '.html':
      return 'text/html';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
