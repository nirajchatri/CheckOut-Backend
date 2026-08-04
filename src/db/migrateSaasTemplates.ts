import 'dotenv/config';
import { LEGACY_SAAS_TEMPLATE_CONTENT } from '../content/cmsDefaults.ts';
import { getPool, sql } from './pool.ts';
import { ensureSchema } from './schema.ts';

export async function migrateSaasTemplatesFromDatabase(): Promise<void> {
  await ensureSchema();
  const pool = await getPool();

  const deletePlatform = await pool.request().query(
    "DELETE FROM dbo.cms_content_fields WHERE field_key LIKE 'platform.%'",
  );
  const platformRemoved = deletePlatform.rowsAffected[0] ?? 0;

  let cleared = 0;
  for (const [fieldKey, templateValue] of Object.entries(LEGACY_SAAS_TEMPLATE_CONTENT)) {
    const result = await pool
      .request()
      .input('field_key', sql.NVarChar(120), fieldKey)
      .input('field_value', sql.NVarChar(sql.MAX), templateValue)
      .query(`
        UPDATE dbo.cms_content_fields
        SET field_value = '', updated_at = SYSUTCDATETIME()
        WHERE field_key = @field_key AND field_value = @field_value
      `);
    cleared += result.rowsAffected[0] ?? 0;
  }

  console.log(`[CMS DB] Removed ${platformRemoved} obsolete platform.* field(s).`);
  console.log(`[CMS DB] Cleared ${cleared} legacy SaaS template field(s).`);
}