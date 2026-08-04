import { isSqlConfigured } from './db/config.ts';
import { initDatabase, readContentFromDatabase, writeContentToDatabase } from './db/init.ts';
import { readContentFromFile, writeContentToFile } from './fileStore.ts';
import type { CmsSectionId, FdRateRow } from './content/cmsDefaults.ts';

export type StoredContent = {
  content: Record<string, string>;
  fdRates: FdRateRow[];
  sections: Record<CmsSectionId, boolean>;
  sectionOrder: CmsSectionId[];
  updatedAt: string;
};

export async function initializeStore(): Promise<void> {
  if (isSqlConfigured()) {
    await initDatabase();
  }
}

export async function readContent(): Promise<StoredContent> {
  if (isSqlConfigured()) {
    return readContentFromDatabase();
  }
  return readContentFromFile();
}

export async function writeContent(data: StoredContent): Promise<void> {
  if (isSqlConfigured()) {
    await writeContentToDatabase(data);
    return;
  }
  writeContentToFile(data);
}

export function getStorageMode(): 'sql' | 'file' {
  return isSqlConfigured() ? 'sql' : 'file';
}
