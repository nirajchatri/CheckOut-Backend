import type { config as SqlConfig } from 'mssql';

export function isSqlConfigured(): boolean {
  return Boolean(process.env.MSSQL_SERVER && process.env.MSSQL_USER && process.env.MSSQL_PASSWORD);
}

export function getSqlConfig(): SqlConfig {
  if (!isSqlConfigured()) {
    throw new Error('MSSQL_SERVER, MSSQL_USER, and MSSQL_PASSWORD must be set in .env');
  }

  return {
    server: process.env.MSSQL_SERVER!,
    port: Number(process.env.MSSQL_PORT ?? 1433),
    database: process.env.MSSQL_DATABASE ?? 'checkout',
    user: process.env.MSSQL_USER!,
    password: process.env.MSSQL_PASSWORD!,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false',
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}
