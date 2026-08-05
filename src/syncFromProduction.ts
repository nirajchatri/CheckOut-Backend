import fs from 'fs';
import path from 'path';
import { mergeCmsPayload } from './content/cmsDefaults.ts';
import { initializeStore, writeContent } from './store.ts';
import { UPLOADS_DIR, ensureUploadsDir } from './uploads.ts';

const PRODUCTION_API = (process.env.PRODUCTION_API_BASE_URL ?? 'https://api.checkout.pe').replace(
  /\/$/,
  '',
);

type ProductionPayload = {
  content?: Record<string, string>;
  fdRates?: Parameters<typeof mergeCmsPayload>[0]['fdRates'];
  sections?: Parameters<typeof mergeCmsPayload>[0]['sections'];
  sectionOrder?: Parameters<typeof mergeCmsPayload>[0]['sectionOrder'];
};

const MEDIA_FILENAME_PATTERN = /\/api\/media\/([a-zA-Z0-9._-]+)/g;

function collectMediaFilenames(payload: ReturnType<typeof mergeCmsPayload>): string[] {
  const filenames = new Set<string>();

  const scan = (value: string | undefined) => {
    if (!value) {
      return;
    }
    for (const match of value.matchAll(MEDIA_FILENAME_PATTERN)) {
      filenames.add(match[1]);
    }
  };

  for (const value of Object.values(payload.content)) {
    scan(value);
  }

  for (const bank of payload.fdRates) {
    scan(bank.logoUrl);
    scan(bank.heroImageUrl);
  }

  return [...filenames];
}

async function fetchProductionPayload(): Promise<ProductionPayload> {
  const url = `${PRODUCTION_API}/api/content`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Production API returned ${response.status} for ${url}`);
  }
  return (await response.json()) as ProductionPayload;
}

async function downloadMediaFile(filename: string): Promise<'downloaded' | 'skipped' | 'failed'> {
  const destination = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(destination)) {
    return 'skipped';
  }

  const url = `${PRODUCTION_API}/api/media/${filename}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`[sync] Could not download ${url} (${response.status})`);
    return 'failed';
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
  return 'downloaded';
}

async function main(): Promise<void> {
  console.log(`[sync] Fetching CMS from ${PRODUCTION_API}/api/content`);

  const raw = await fetchProductionPayload();
  const payload = mergeCmsPayload(raw);

  await initializeStore();
  await writeContent({
    content: payload.content,
    fdRates: payload.fdRates,
    sections: payload.sections,
    sectionOrder: payload.sectionOrder,
    updatedAt: new Date().toISOString(),
  });

  ensureUploadsDir();
  const mediaFiles = collectMediaFilenames(payload);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of mediaFiles) {
    const result = await downloadMediaFile(filename);
    if (result === 'downloaded') {
      downloaded += 1;
    } else if (result === 'skipped') {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  const populatedFields = Object.values(payload.content).filter(Boolean).length;
  console.log(`[sync] CMS saved (${populatedFields} content fields, ${payload.fdRates.length} FD banks)`);
  console.log(`[sync] Section order: ${payload.sectionOrder.join(' → ')}`);
  console.log(`[sync] Media files: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
  console.log('[sync] Local data now matches production.');
}

main().catch((error) => {
  console.error('[sync] Failed:', error);
  process.exit(1);
});
