import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { DatabaseAdapter, ModelDelegate } from './database.types';
import { createDatabaseAdapter, getDatabaseProviderLabel } from './database.factory';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private adapter!: DatabaseAdapter;

  readonly project!: ModelDelegate;
  readonly environment!: ModelDelegate;
  readonly testSuite!: ModelDelegate;
  readonly testCase!: ModelDelegate;
  readonly stepDefinition!: ModelDelegate;
  readonly pageObject!: ModelDelegate;
  readonly secret!: ModelDelegate;
  readonly user!: ModelDelegate;
  readonly schedule!: ModelDelegate;
  readonly testRun!: ModelDelegate;
  readonly testResult!: ModelDelegate;

  get provider(): string {
    return getDatabaseProviderLabel();
  }

  async onModuleInit() {
    this.adapter = await createDatabaseAdapter();
    Object.assign(this, {
      project: this.adapter.project,
      environment: this.adapter.environment,
      testSuite: this.adapter.testSuite,
      testCase: this.adapter.testCase,
      stepDefinition: this.adapter.stepDefinition,
      pageObject: this.adapter.pageObject,
      secret: this.adapter.secret,
      user: this.adapter.user,
      schedule: this.adapter.schedule,
      testRun: this.adapter.testRun,
      testResult: this.adapter.testResult,
    });
    await this.adapter.connect();
  }

  async onModuleDestroy() {
    await this.adapter?.disconnect();
  }
}
