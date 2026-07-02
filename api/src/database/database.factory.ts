import { join } from 'path';
import { getDbProvider, getJsonDbPath } from './database.config';
import { FileSnapshotStore } from './file-snapshot-store';
import { OracleSnapshotStore } from './oracle-snapshot-store';
import { PrismaDatabaseAdapter } from './prisma-database.adapter';
import { SnapshotDatabaseAdapter } from './snapshot-database.adapter';
import type { DatabaseAdapter } from './database.types';

export async function createDatabaseAdapter(): Promise<DatabaseAdapter> {
  const provider = getDbProvider();
  if (provider === 'json') {
    const filePath = join(__dirname, '..', '..', getJsonDbPath());
    const store = await FileSnapshotStore.open(filePath);
    return new SnapshotDatabaseAdapter(store);
  }
  if (provider === 'oracle') {
    const store = await OracleSnapshotStore.open();
    return new SnapshotDatabaseAdapter(store);
  }
  return PrismaDatabaseAdapter.create();
}

export function getDatabaseProviderLabel(): string {
  return getDbProvider();
}
