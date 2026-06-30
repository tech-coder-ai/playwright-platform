import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecretsModule } from '../secrets/secrets.module';
import { RunQueueService } from './run-queue.service';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';

@Module({
  imports: [SecretsModule, NotificationsModule],
  controllers: [TestRunsController],
  providers: [TestRunsService, RunQueueService],
  exports: [TestRunsService],
})
export class TestRunnerModule {}
