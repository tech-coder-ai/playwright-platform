import type { DbProvider } from './database.types';

export function getDbProvider(): DbProvider {
  const value = process.env['DB_PROVIDER']?.toLowerCase();
  if (value === 'json' || value === 'oracle') return value;
  return 'prisma';
}

export function getJsonDbPath(): string {
  return process.env['JSON_DB_PATH'] ?? '../data/platform.json';
}

export function getOracleConfig() {
  return {
    user: process.env['ORACLE_USER'] ?? '',
    password: process.env['ORACLE_PASSWORD'] ?? '',
    connectionString: process.env['ORACLE_CONNECTION_STRING'] ?? '',
  };
}
