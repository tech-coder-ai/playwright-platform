import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { ProjectsModule } from './projects/projects.module';
import { EnvironmentsModule } from './environments/environments.module';
import { TestSuitesModule } from './test-suites/test-suites.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { SecretsModule } from './secrets/secrets.module';
import { TestRunnerModule } from './test-runner/test-runner.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SchedulesModule } from './schedules/schedules.module';
import { CodegenModule } from './codegen/codegen.module';
import { PageObjectsModule } from './page-objects/page-objects.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CryptoModule,
    ProjectsModule,
    EnvironmentsModule,
    TestSuitesModule,
    TestCasesModule,
    SecretsModule,
    TestRunnerModule,
    DashboardModule,
    SchedulesModule,
    CodegenModule,
    PageObjectsModule,
    UsersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
