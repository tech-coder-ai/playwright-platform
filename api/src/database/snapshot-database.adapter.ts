import type { DatabaseAdapter } from './database.types';
import { JsonModelDelegate } from './json-model.delegate';
import type { SnapshotStore } from './snapshot-store';

export class SnapshotDatabaseAdapter implements DatabaseAdapter {
  readonly project: JsonModelDelegate;
  readonly environment: JsonModelDelegate;
  readonly testSuite: JsonModelDelegate;
  readonly testCase: JsonModelDelegate;
  readonly stepDefinition: JsonModelDelegate;
  readonly pageObject: JsonModelDelegate;
  readonly secret: JsonModelDelegate;
  readonly user: JsonModelDelegate;
  readonly schedule: JsonModelDelegate;
  readonly testRun: JsonModelDelegate;
  readonly testResult: JsonModelDelegate;

  constructor(private readonly store: SnapshotStore) {
    this.project = new JsonModelDelegate(store, 'project');
    this.environment = new JsonModelDelegate(store, 'environment');
    this.testSuite = new JsonModelDelegate(store, 'testSuite');
    this.testCase = new JsonModelDelegate(store, 'testCase');
    this.stepDefinition = new JsonModelDelegate(store, 'stepDefinition');
    this.pageObject = new JsonModelDelegate(store, 'pageObject');
    this.secret = new JsonModelDelegate(store, 'secret');
    this.user = new JsonModelDelegate(store, 'user');
    this.schedule = new JsonModelDelegate(store, 'schedule');
    this.testRun = new JsonModelDelegate(store, 'testRun');
    this.testResult = new JsonModelDelegate(store, 'testResult');
  }

  async connect(): Promise<void> {
    await this.store.connect();
  }

  async disconnect(): Promise<void> {
    await this.store.disconnect();
  }
}
