import type { config as SqlConfig } from 'mssql';

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function isSqlConfigured(): boolean {
  return Boolean(env('MSSQL_SERVER') && env('MSSQL_USER') && env('MSSQL_PASSWORD'));
}

export function getSqlConfig(): SqlConfig {
  if (!isSqlConfigured()) {
    throw new Error('MSSQL_SERVER, MSSQL_USER, and MSSQL_PASSWORD must be set in .env');
  }

  return {
    server: env('MSSQL_SERVER'),
    port: Number(env('MSSQL_PORT') || 1433),
    database: env('MSSQL_DATABASE') || 'checkout',
    user: env('MSSQL_USER'),
    password: env('MSSQL_PASSWORD'),
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false',
    },
    connectionTimeout: Number(process.env.MSSQL_CONNECTION_TIMEOUT ?? 8_000),
    requestTimeout: Number(process.env.MSSQL_REQUEST_TIMEOUT ?? 15_000),
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}
