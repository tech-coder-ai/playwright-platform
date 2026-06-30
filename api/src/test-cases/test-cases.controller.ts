import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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
