import { PrismaClient } from '@prisma/client';
import type { DatabaseAdapter, ModelDelegate } from './database.types';

function asDelegate<T>(delegate: T): ModelDelegate {
  return delegate as unknown as ModelDelegate;
}

export class PrismaDatabaseAdapter implements DatabaseAdapter {
  readonly project: ModelDelegate;
  readonly environment: ModelDelegate;
  readonly testSuite: ModelDelegate;
  readonly testCase: ModelDelegate;
  readonly stepDefinition: ModelDelegate;
  readonly pageObject: ModelDelegate;
  readonly secret: ModelDelegate;
  readonly user: ModelDelegate;
  readonly schedule: ModelDelegate;
  readonly testRun: ModelDelegate;
  readonly testResult: ModelDelegate;

  private constructor(private readonly client: PrismaClient) {
    this.project = asDelegate(client.project);
    this.environment = asDelegate(client.environment);
    this.testSuite = asDelegate(client.testSuite);
    this.testCase = asDelegate(client.testCase);
    this.stepDefinition = asDelegate(client.stepDefinition);
    this.pageObject = asDelegate(client.pageObject);
    this.secret = asDelegate(client.secret);
    this.user = asDelegate(client.user);
    this.schedule = asDelegate(client.schedule);
    this.testRun = asDelegate(client.testRun);
    this.testResult = asDelegate(client.testResult);
  }

  static create(): PrismaDatabaseAdapter {
    return new PrismaDatabaseAdapter(new PrismaClient());
  }

  async connect(): Promise<void> {
    await this.client.$connect();
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}
