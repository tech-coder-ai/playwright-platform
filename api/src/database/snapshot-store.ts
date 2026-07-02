import type { JsonStoreSnapshot } from './database.types';
import { EMPTY_JSON_STORE } from './database.types';

export abstract class SnapshotStore {
  protected snapshot: JsonStoreSnapshot = structuredClone(EMPTY_JSON_STORE);
  private writeQueue: Promise<void> = Promise.resolve();

  getCollection(key: keyof JsonStoreSnapshot): Record<string, unknown>[] {
    return this.snapshot[key];
  }

  async connect(): Promise<void> {
    await this.load();
  }

  async disconnect(): Promise<void> {
    await this.writeQueue;
  }

  async mutate(mutator: (snapshot: JsonStoreSnapshot) => void): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      mutator(this.snapshot);
      await this.persist();
    });
    await this.writeQueue;
  }

  protected resetSnapshot(data: Partial<JsonStoreSnapshot>): void {
    this.snapshot = { ...structuredClone(EMPTY_JSON_STORE), ...data };
    for (const key of Object.keys(EMPTY_JSON_STORE) as (keyof JsonStoreSnapshot)[]) {
      if (!Array.isArray(this.snapshot[key])) {
        this.snapshot[key] = [];
      }
    }
  }

  protected abstract load(): Promise<void>;
  protected abstract persist(): Promise<void>;
}
