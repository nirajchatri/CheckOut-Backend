import fs from 'fs';
import path from 'path';
import { getPool } from './pool.ts';
import { migrateFromFileStore, writeContentToDb } from './cmsStore.ts';
import { ensureSchema } from './schema.ts';
import {
  createEmptyCmsContent,
  DEFAULT_FD_RATES,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SECTION_VISIBILITY,
  mergeFdRates,
} from '../content/cmsDefaults.ts';
import type { StoredContent } from '../store.ts';

const CONTENT_FILE = path.resolve(process.cwd(), 'data/content.enc');

let initialized = false;

async function migrateExistingFileStoreIfPresent(): Promise<void> {
  if (!fs.existsSync(CONTENT_FILE)) {
    return;
  }

  const { readContentFromFile } = await import('../fileStore.ts');
  await migrateFromFileStore(readContentFromFile());
  console.log('[CMS DB] Migrated existing encrypted file store into SQL Server.');
}

async function seedDefaults(): Promise<void> {
  await writeContentToDb({
    content: createEmptyCmsContent(),
    fdRates: mergeFdRates(DEFAULT_FD_RATES),
    sections: { ...DEFAULT_SECTION_VISIBILITY },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    updatedAt: new Date().toISOString(),
  });
}

export async function initDatabase(): Promise<void> {
  if (initialized) {
    return;
  }

  await ensureSchema();

  const pool = await getPool();
  const result = await pool.request().query<{ count: number }>(
    'SELECT COUNT(1) AS count FROM dbo.cms_content_fields',
  );
  const isEmpty = (result.recordset[0]?.count ?? 0) === 0;

  if (isEmpty) {
    if (fs.existsSync(CONTENT_FILE)) {
      await migrateExistingFileStoreIfPresent();
    } else {
      await seedDefaults();
      console.log('[CMS DB] Seeded default CMS content into SQL Server.');
    }
  }

  initialized = true;
  console.log('[CMS DB] Connected to SQL Server and schema is ready.');
}

export { readContentFromDb as readContentFromDatabase } from './cmsStore.ts';
export { writeContentToDb as writeContentToDatabase } from './cmsStore.ts';
