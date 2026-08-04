import 'dotenv/config';
import { getSqlConfig, isSqlConfigured } from './config.ts';
import { getPool, closePool } from './pool.ts';

if (!isSqlConfigured()) {
  console.error('MSSQL_SERVER, MSSQL_USER, and MSSQL_PASSWORD must be set in .env');
  process.exit(1);
}

const { server, port, database, user } = getSqlConfig();

console.log(`Testing SQL connection to ${server}:${port}/${database} as ${user}...`);

try {
  const pool = await getPool();
  const result = await pool.request().query<{ ok: number }>('SELECT 1 AS ok');
  console.log('SUCCESS:', result.recordset[0]);
  await closePool();
  process.exit(0);
} catch (error) {
  console.error('FAILED:', error instanceof Error ? error.message : error);
  await closePool().catch(() => undefined);
  process.exit(1);
}
