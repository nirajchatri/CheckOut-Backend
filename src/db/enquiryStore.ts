import { getPool, sql } from './pool.ts';

export type EnquiryRecord = {
  name: string;
  email: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  message: string;
  ipAddress?: string;
};

export async function insertEnquiry(record: EnquiryRecord): Promise<string> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), record.name)
    .input('email', sql.NVarChar(320), record.email)
    .input('mobile', sql.NVarChar(30), record.mobile)
    .input('address', sql.NVarChar(500), record.address)
    .input('city', sql.NVarChar(100), record.city)
    .input('state', sql.NVarChar(100), record.state)
    .input('pin', sql.NVarChar(10), record.pin)
    .input('message', sql.NVarChar(sql.MAX), record.message)
    .input('ip_address', sql.NVarChar(45), record.ipAddress ?? null)
    .query<{ enquiry_id: string }>(`
      INSERT INTO dbo.enquiries (name, email, mobile, address, city, state, pin, message, ip_address)
      OUTPUT INSERTED.enquiry_id
      VALUES (@name, @email, @mobile, @address, @city, @state, @pin, @message, @ip_address);
    `);

  const enquiryId = result.recordset[0]?.enquiry_id;
  if (!enquiryId) {
    throw new Error('Failed to save enquiry.');
  }

  return enquiryId;
}
