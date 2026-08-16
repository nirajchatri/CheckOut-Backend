import type { config as SqlConfig } from 'mssql';
import { isSqlConfigured } from './config.ts';

/** True when we can reach XeroCode control DB (explicit vars or shared MSSQL_* credentials). */
export function isXerocodeSqlConfigured(): boolean {
  if (process.env.XEROCODE_MSSQL_SERVER && process.env.XEROCODE_MSSQL_USER && process.env.XEROCODE_MSSQL_PASSWORD) {
    return true;
  }
  return isSqlConfigured();
}

export function getXerocodeSqlConfig(): SqlConfig {
  if (!isXerocodeSqlConfigured()) {
    throw new Error(
      'XeroCode SQL is not configured. Set XEROCODE_MSSQL_* or MSSQL_SERVER/USER/PASSWORD in .env',
    );
  }

  const useExplicit =
    Boolean(process.env.XEROCODE_MSSQL_SERVER) &&
    Boolean(process.env.XEROCODE_MSSQL_USER) &&
    Boolean(process.env.XEROCODE_MSSQL_PASSWORD);

  return {
    server: useExplicit ? process.env.XEROCODE_MSSQL_SERVER! : process.env.MSSQL_SERVER!,
    port: Number(
      (useExplicit ? process.env.XEROCODE_MSSQL_PORT : process.env.MSSQL_PORT) ?? 1433,
    ),
    database: process.env.XEROCODE_MSSQL_DATABASE ?? 'xerocode',
    user: useExplicit ? process.env.XEROCODE_MSSQL_USER! : process.env.MSSQL_USER!,
    password: useExplicit ? process.env.XEROCODE_MSSQL_PASSWORD! : process.env.MSSQL_PASSWORD!,
    options: {
      encrypt:
        (useExplicit ? process.env.XEROCODE_MSSQL_ENCRYPT : process.env.MSSQL_ENCRYPT) === 'true',
      trustServerCertificate:
        (useExplicit
          ? process.env.XEROCODE_MSSQL_TRUST_SERVER_CERTIFICATE
          : process.env.MSSQL_TRUST_SERVER_CERTIFICATE) !== 'false',
    },
    connectionTimeout: Number(process.env.MSSQL_CONNECTION_TIMEOUT ?? 8_000),
    requestTimeout: Number(process.env.MSSQL_REQUEST_TIMEOUT ?? 30_000),
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}
