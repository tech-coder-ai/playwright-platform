import { Module } from '@nestjs/common';
import { TestRunnerModule } from '../test-runner/test-runner.module';
import { SchedulerService } from './scheduler.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [TestRunnerModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulerService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
