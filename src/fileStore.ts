import fs from 'fs';
import path from 'path';
import {
  createEmptyCmsContent,
  DEFAULT_FD_RATES,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SECTION_VISIBILITY,
  mergeFdRates,
  mergeSectionOrder,
} from './content/cmsDefaults.ts';
import { decryptPayload, encryptPayload } from './crypto.ts';
import type { StoredContent } from './store.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.enc');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readContentFromFile(): StoredContent {
  ensureDataDir();

  if (!fs.existsSync(CONTENT_FILE)) {
    return {
      content: createEmptyCmsContent(),
      fdRates: mergeFdRates(DEFAULT_FD_RATES),
      sections: { ...DEFAULT_SECTION_VISIBILITY },
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      updatedAt: new Date().toISOString(),
    };
  }

  const encrypted = fs.readFileSync(CONTENT_FILE, 'utf8');
  const parsed = decryptPayload<Partial<StoredContent>>(encrypted);

  return {
    content: { ...createEmptyCmsContent(), ...(parsed.content ?? {}) },
    fdRates: mergeFdRates(parsed.fdRates),
    sections: { ...DEFAULT_SECTION_VISIBILITY, ...(parsed.sections ?? {}) },
    sectionOrder: mergeSectionOrder(parsed.sectionOrder),
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

export function writeContentToFile(data: StoredContent): void {
  ensureDataDir();
  const encrypted = encryptPayload(data);
  fs.writeFileSync(CONTENT_FILE, encrypted, 'utf8');
}
