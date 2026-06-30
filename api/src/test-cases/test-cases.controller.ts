import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import type { UpdateTestCaseSourceDto } from '@playwright-platform/shared-types';
import { TestCasesService } from './test-cases.service';

@Controller()
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

  @Get('test-suites/:suiteId/test-cases')
  findBySuite(@Param('suiteId') suiteId: string) {
    return this.testCasesService.findBySuite(suiteId);
  }

  @Get('test-cases/:id')
  findOne(@Param('id') id: string) {
    return this.testCasesService.findOne(id);
  }

  @Post('test-suites/:suiteId/test-cases')
  create(
    @Param('suiteId') suiteId: string,
    @Body()
    body: {
      name: string;
      type: string;
      filePath: string;
      tags?: string[];
    },
  ) {
    return this.testCasesService.create(suiteId, body);
  }

  @Get('test-cases/:id/source')
  getSource(@Param('id') id: string) {
    return this.testCasesService.getSource(id);
  }

  @Put('test-cases/:id/source')
  updateSource(@Param('id') id: string, @Body() body: UpdateTestCaseSourceDto) {
    return this.testCasesService.updateSource(id, body);
  }

  @Patch('test-cases/:id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      type?: string;
      filePath?: string;
      tags?: string[];
    },
  ) {
    return this.testCasesService.update(id, body);
  }

  @Delete('test-cases/:id')
  remove(@Param('id') id: string) {
    return this.testCasesService.remove(id);
  }
}
