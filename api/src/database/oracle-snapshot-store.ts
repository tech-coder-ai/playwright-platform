import { join } from 'path';
import { SnapshotStore } from './snapshot-store';
import type { JsonStoreSnapshot } from './database.types';
import { getOracleConfig } from './database.config';
import {
  ORACLE_TABLES,
  recordToBinds,
  rowToRecord,
  type OracleConnection,
  type OracleModule,
} from './oracle-mapping';

async function loadOracleModule(): Promise<OracleModule> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('oracledb') as OracleModule;
  } catch {
    throw new Error(
      'DB_PROVIDER=oracle requires the optional "oracledb" package. Install with: npm install oracledb --workspace=api',
    );
  }
}

type OraclePool = {
  getConnection(): Promise<OracleConnection>;
  close(): Promise<void>;
};

async function createOraclePool(
  config: Record<string, string>,
): Promise<OraclePool> {
  const oracledb = await loadOracleModule();
  return oracledb.createPool(config);
}

export class OracleSnapshotStore extends SnapshotStore {
  private pool: OraclePool | null = null;

  static async open(): Promise<OracleSnapshotStore> {
    const store = new OracleSnapshotStore();
    await store.connect();
    return store;
  }

  override async disconnect(): Promise<void> {
    await super.disconnect();
    if (this.pool) {
      await this.pool.close();
    }
    this.pool = null;
  }

  protected async load(): Promise<void> {
    const config = getOracleConfig();
    if (!config.user || !config.password || !config.connectionString) {
      throw new Error(
        'Oracle requires ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECTION_STRING in api/.env',
      );
    }

    this.pool = await createOraclePool({
      user: config.user,
      password: config.password,
      connectString: config.connectionString,
    });

    const snapshot: Partial<JsonStoreSnapshot> = {};
    const pool = this.pool;
    const connection = await pool.getConnection();
    try {
      for (const spec of ORACLE_TABLES) {
        const result = await connection.execute<Record<string, unknown>>(
          `SELECT ${spec.columns.map((column) => column.column).join(', ')} FROM ${spec.table}`,
        );
        snapshot[spec.key] = (result.rows ?? []).map((row) => rowToRecord(row, spec.columns));
      }
    } finally {
      await connection.close();
    }

    this.resetSnapshot(snapshot);
  }

  protected async persist(): Promise<void> {
    if (!this.pool) return;
    const connection = await this.pool.getConnection();
    try {
      for (const spec of ORACLE_TABLES) {
        await connection.execute(`DELETE FROM ${spec.table}`);
        for (const record of this.snapshot[spec.key]) {
          const binds = recordToBinds(record, spec.columns);
          const placeholders = spec.columns.map((column) => `:${column.column}`).join(', ');
          await connection.execute(
            `INSERT INTO ${spec.table} (${spec.columns.map((column) => column.column).join(', ')}) VALUES (${placeholders})`,
            binds,
          );
        }
      }
      await connection.commit();
    } finally {
      await connection.close();
    }
  }
}

export function getOracleSchemaPath(): string {
  return join(__dirname, '..', '..', 'database', 'oracle', 'schema.sql');
}
