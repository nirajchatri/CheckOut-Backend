import { getPool, sql } from './pool.ts';

export type InvestorRecord = {
  name: string;
  email: string;
  mobile: string;
  fundName: string;
  message: string;
  ipAddress?: string;
};

export async function insertInvestor(record: InvestorRecord): Promise<string> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), record.name)
    .input('email', sql.NVarChar(320), record.email)
    .input('mobile', sql.NVarChar(30), record.mobile)
    .input('fund_name', sql.NVarChar(300), record.fundName)
    .input('message', sql.NVarChar(sql.MAX), record.message)
    .input('ip_address', sql.NVarChar(45), record.ipAddress ?? null)
    .query<{ investor_id: string }>(`
      INSERT INTO dbo.investor_details (name, email, mobile, fund_name, message, ip_address)
      OUTPUT INSERTED.investor_id
      VALUES (@name, @email, @mobile, @fund_name, @message, @ip_address);
    `);

  const investorId = result.recordset[0]?.investor_id;
  if (!investorId) {
    throw new Error('Failed to save investor details.');
  }

  return investorId;
}
