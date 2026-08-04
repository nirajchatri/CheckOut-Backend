import { isIP } from 'node:net';
import type { config as SqlConfig } from 'mssql';

function env(primary: string, fallback?: string): string {
  const value = (process.env[primary] ?? process.env[fallback ?? ''] ?? '').trim();
  return value;
}

function envFlag(primary: string, fallback: string, defaultValue: boolean): boolean {
  const raw = env(primary, fallback);
  if (!raw) {
    return defaultValue;
  }
  return raw.toLowerCase() !== 'false';
}

function buildSqlServerTlsOptions(server: string): sqlOptions {
  const options: sqlOptions = {
    encrypt: envFlag('MSSQL_ENCRYPT', 'SQLSERVER_CONTROL_ENCRYPT', true),
    trustServerCertificate: envFlag(
      'MSSQL_TRUST_SERVER_CERTIFICATE',
      'SQLSERVER_CONTROL_TRUST_CERT',
      true,
    ),
  };

  const tlsServerName = env('MSSQL_TLS_SERVER_NAME', 'SQLSERVER_TLS_SERVER_NAME');
  if (tlsServerName) {
    options.serverName = tlsServerName;
  } else if (isIP(server)) {
    // Same as XeroCode-Backend: required when connecting to SQL Server by IP over TLS.
    options.serverName = 'localhost';
  }

  return options;
}

type sqlOptions = NonNullable<SqlConfig['options']>;

export function isSqlConfigured(): boolean {
  const server = env('MSSQL_SERVER', 'SQLSERVER_CONTROL_HOST');
  const user = env('MSSQL_USER', 'SQLSERVER_CONTROL_USER');
  const password = env('MSSQL_PASSWORD', 'SQLSERVER_CONTROL_PASSWORD');
  return Boolean(server && user && password);
}

export function getSqlConfig(): SqlConfig {
  const server = env('MSSQL_SERVER', 'SQLSERVER_CONTROL_HOST') || '172.31.11.96';
  const user = env('MSSQL_USER', 'SQLSERVER_CONTROL_USER') || 'sa';
  const password = env('MSSQL_PASSWORD', 'SQLSERVER_CONTROL_PASSWORD');

  if (!password) {
    throw new Error(
      'Set MSSQL_PASSWORD or SQLSERVER_CONTROL_PASSWORD in .env (quote values containing $).',
    );
  }

  return {
    server,
    port: Number(env('MSSQL_PORT', 'SQLSERVER_CONTROL_PORT') || 1433),
    database: env('MSSQL_DATABASE', 'SQLSERVER_CONTROL_DATABASE') || 'checkout',
    user,
    password,
    options: buildSqlServerTlsOptions(server),
    connectionTimeout: Number(env('MSSQL_CONNECTION_TIMEOUT') || 20_000),
    requestTimeout: Number(env('MSSQL_REQUEST_TIMEOUT') || 20_000),
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}
