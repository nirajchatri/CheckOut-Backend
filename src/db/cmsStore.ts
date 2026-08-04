import {
  createEmptyCmsContent,
  DEFAULT_FD_RATES,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SECTION_VISIBILITY,
  mergeFdRates,
  mergeSectionOrder,
  type CmsSectionId,
  type FdRateRow,
} from '../content/cmsDefaults.ts';
import type { StoredContent } from '../store.ts';
import { getPool, sql } from './pool.ts';

function buildTenureDbId(bankId: string, tenureId: string): string {
  return `${bankId}__${tenureId}`;
}

function parseTenureDbId(tenureDbId: string): string {
  const separatorIndex = tenureDbId.indexOf('__');
  return separatorIndex >= 0 ? tenureDbId.slice(separatorIndex + 2) : tenureDbId;
}

export async function readContentFromDb(): Promise<StoredContent> {
  const pool = await getPool();

  const [contentResult, sectionsResult, orderResult, banksResult, tenuresResult, metaResult] =
    await Promise.all([
      pool.request().query<{ field_key: string; field_value: string }>(
        'SELECT field_key, field_value FROM dbo.cms_content_fields',
      ),
      pool.request().query<{ section_id: string; is_visible: boolean }>(
        'SELECT section_id, is_visible FROM dbo.cms_section_visibility',
      ),
      pool.request().query<{ section_id: string; sort_index: number }>(
        'SELECT section_id, sort_index FROM dbo.cms_section_order ORDER BY sort_index',
      ),
      pool.request().query<{
        bank_id: string;
        bank_name: string;
        headline_rate: string;
        logo_url: string;
        hero_image_url: string;
      }>('SELECT bank_id, bank_name, headline_rate, logo_url, hero_image_url FROM dbo.fd_banks WHERE is_active = 1 ORDER BY sort_order'),
      pool.request().query<{
        bank_id: string;
        tenure_id: string;
        tenure_label: string;
        months: number;
        regular_rate: number;
        senior_rate: number;
        is_popular: boolean;
        sort_order: number;
      }>(
        'SELECT bank_id, tenure_id, tenure_label, months, regular_rate, senior_rate, is_popular, sort_order FROM dbo.fd_bank_tenures ORDER BY bank_id, sort_order',
      ),
      pool.request().query<{ meta_value: string }>(
        "SELECT meta_value FROM dbo.cms_meta WHERE meta_key = 'updated_at'",
      ),
    ]);

  const content: Record<string, string> = createEmptyCmsContent();
  for (const row of contentResult.recordset) {
    content[row.field_key] = row.field_value;
  }

  const sections = { ...DEFAULT_SECTION_VISIBILITY } as Record<CmsSectionId, boolean>;
  for (const row of sectionsResult.recordset) {
    sections[row.section_id as CmsSectionId] = Boolean(row.is_visible);
  }

  const sectionOrder = mergeSectionOrder(
    orderResult.recordset.map((row: { section_id: string }) => row.section_id as CmsSectionId),
  );

  const tenuresByBank = new Map<string, FdRateRow['tenures']>();
  for (const row of tenuresResult.recordset) {
    const list = tenuresByBank.get(row.bank_id) ?? [];
    list.push({
      id: parseTenureDbId(row.tenure_id),
      label: row.tenure_label,
      months: row.months,
      regularRate: Number(row.regular_rate),
      seniorRate: Number(row.senior_rate),
      popular: Boolean(row.is_popular),
    });
    tenuresByBank.set(row.bank_id, list);
  }

  const fdRates = mergeFdRates(
    banksResult.recordset.map((bank: {
      bank_id: string;
      bank_name: string;
      headline_rate: string;
      logo_url: string;
      hero_image_url: string;
    }) => ({
      id: bank.bank_id,
      name: bank.bank_name,
      rate: bank.headline_rate,
      logoUrl: bank.logo_url,
      heroImageUrl: bank.hero_image_url,
      tenures: tenuresByBank.get(bank.bank_id) ?? [],
    })),
  );

  const updatedAt = metaResult.recordset[0]?.meta_value ?? new Date().toISOString();

  return {
    content,
    fdRates,
    sections,
    sectionOrder,
    updatedAt,
  };
}

export async function writeContentToDb(data: StoredContent): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    for (const [fieldKey, fieldValue] of Object.entries(data.content)) {
      await new sql.Request(transaction)
        .input('field_key', sql.NVarChar(120), fieldKey)
        .input('field_value', sql.NVarChar(sql.MAX), fieldValue)
        .query(`
          MERGE dbo.cms_content_fields AS target
          USING (SELECT @field_key AS field_key) AS source
          ON target.field_key = source.field_key
          WHEN MATCHED THEN
            UPDATE SET field_value = @field_value, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (field_key, field_value) VALUES (@field_key, @field_value);
        `);
    }

    for (const [sectionId, isVisible] of Object.entries(data.sections)) {
      await new sql.Request(transaction)
        .input('section_id', sql.NVarChar(50), sectionId)
        .input('is_visible', sql.Bit, isVisible ? 1 : 0)
        .query(`
          MERGE dbo.cms_section_visibility AS target
          USING (SELECT @section_id AS section_id) AS source
          ON target.section_id = source.section_id
          WHEN MATCHED THEN
            UPDATE SET is_visible = @is_visible, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (section_id, is_visible) VALUES (@section_id, @is_visible);
        `);
    }

    await new sql.Request(transaction).query('DELETE FROM dbo.cms_section_order');

    for (let index = 0; index < data.sectionOrder.length; index += 1) {
      const sectionId = data.sectionOrder[index];
      await new sql.Request(transaction)
        .input('sort_index', sql.Int, index)
        .input('section_id', sql.NVarChar(50), sectionId)
        .query('INSERT INTO dbo.cms_section_order (sort_index, section_id) VALUES (@sort_index, @section_id)');
    }

    const normalizedRates = mergeFdRates(data.fdRates);
    const incomingBankIds = normalizedRates.map((bank) => bank.id);

    if (incomingBankIds.length === 0) {
      await new sql.Request(transaction).query('DELETE FROM dbo.fd_banks');
    } else {
      const placeholders = incomingBankIds.map((_, index) => `@bank_id_${index}`).join(', ');
      const deleteRequest = new sql.Request(transaction);
      incomingBankIds.forEach((bankId, index) => {
        deleteRequest.input(`bank_id_${index}`, sql.NVarChar(80), bankId);
      });
      await deleteRequest.query(`DELETE FROM dbo.fd_banks WHERE bank_id NOT IN (${placeholders})`);
    }

    for (let bankIndex = 0; bankIndex < normalizedRates.length; bankIndex += 1) {
      const bank = normalizedRates[bankIndex];

      await new sql.Request(transaction)
        .input('bank_id', sql.NVarChar(80), bank.id)
        .input('bank_name', sql.NVarChar(200), bank.name)
        .input('headline_rate', sql.NVarChar(20), bank.rate)
        .input('logo_url', sql.NVarChar(500), bank.logoUrl ?? '')
        .input('hero_image_url', sql.NVarChar(500), bank.heroImageUrl ?? '')
        .input('sort_order', sql.Int, bankIndex)
        .query(`
          MERGE dbo.fd_banks AS target
          USING (SELECT @bank_id AS bank_id) AS source
          ON target.bank_id = source.bank_id
          WHEN MATCHED THEN
            UPDATE SET
              bank_name = @bank_name,
              headline_rate = @headline_rate,
              logo_url = @logo_url,
              hero_image_url = @hero_image_url,
              sort_order = @sort_order,
              is_active = 1,
              updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (bank_id, bank_name, headline_rate, logo_url, hero_image_url, sort_order, is_active)
            VALUES (@bank_id, @bank_name, @headline_rate, @logo_url, @hero_image_url, @sort_order, 1);
        `);

      await new sql.Request(transaction)
        .input('bank_id', sql.NVarChar(80), bank.id)
        .query('DELETE FROM dbo.fd_bank_tenures WHERE bank_id = @bank_id');

      for (let tenureIndex = 0; tenureIndex < bank.tenures.length; tenureIndex += 1) {
        const tenure = bank.tenures[tenureIndex];
        await new sql.Request(transaction)
          .input('tenure_id', sql.NVarChar(80), buildTenureDbId(bank.id, tenure.id))
          .input('bank_id', sql.NVarChar(80), bank.id)
          .input('tenure_label', sql.NVarChar(30), tenure.label)
          .input('months', sql.Int, tenure.months)
          .input('regular_rate', sql.Decimal(6, 3), tenure.regularRate)
          .input('senior_rate', sql.Decimal(6, 3), tenure.seniorRate)
          .input('is_popular', sql.Bit, tenure.popular ? 1 : 0)
          .input('sort_order', sql.Int, tenureIndex)
          .query(`
            INSERT INTO dbo.fd_bank_tenures (
              tenure_id, bank_id, tenure_label, months, regular_rate, senior_rate, is_popular, sort_order
            ) VALUES (
              @tenure_id, @bank_id, @tenure_label, @months, @regular_rate, @senior_rate, @is_popular, @sort_order
            )
          `);
      }
    }

    await new sql.Request(transaction)
      .input('meta_value', sql.NVarChar(500), data.updatedAt)
      .query(`
        MERGE dbo.cms_meta AS target
        USING (SELECT 'updated_at' AS meta_key) AS source
        ON target.meta_key = source.meta_key
        WHEN MATCHED THEN
          UPDATE SET meta_value = @meta_value, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (meta_key, meta_value) VALUES ('updated_at', @meta_value);
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function migrateFromFileStore(fileData: StoredContent): Promise<void> {
  await writeContentToDb(fileData);
}
