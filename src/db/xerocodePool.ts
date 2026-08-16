import sql from 'mssql';
import { getXerocodeSqlConfig, isXerocodeSqlConfigured } from './xerocodeConfig.ts';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getXerocodePool(): Promise<sql.ConnectionPool> {
  if (!isXerocodeSqlConfigured()) {
    throw new Error('XeroCode SQL is not configured.');
  }

  if (!poolPromise) {
    const pool = new sql.ConnectionPool(getXerocodeSqlConfig());
    poolPromise = pool.connect().catch((error: unknown) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

export async function closeXerocodePool(): Promise<void> {
  if (!poolPromise) {
    return;
  }

  const pool = await poolPromise;
  await pool.close();
  poolPromise = null;
}

export { sql as xerocodeSql };
