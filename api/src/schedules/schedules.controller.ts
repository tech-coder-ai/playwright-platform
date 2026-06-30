import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type {
  CreateScheduleDto,
  UpdateScheduleDto,
} from '@playwright-platform/shared-types';
import { SchedulesService } from './schedules.service';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('projects/:projectId/schedules')
  findByProject(@Param('projectId') projectId: string) {
    return this.schedulesService.findByProject(projectId);
  }

  @Get('schedules/:id')
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  @Post('projects/:projectId/schedules')
  create(@Param('projectId') projectId: string, @Body() body: CreateScheduleDto) {
    return this.schedulesService.create(projectId, body);
  }

  @Patch('schedules/:id')
  update(@Param('id') id: string, @Body() body: UpdateScheduleDto) {
    return this.schedulesService.update(id, body);
  }

  @Delete('schedules/:id')
  remove(@Param('id') id: string) {
    return this.schedulesService.remove(id);
  }

  @Post('schedules/:id/run-now')
  runNow(@Param('id') id: string) {
    return this.schedulesService.runNow(id);
  }
}
