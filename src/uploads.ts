import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'data/uploads');
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function isAllowedImageField(fieldKey: string, allowedKeys: Set<string>): boolean {
  if (!fieldKey) {
    return false;
  }
  if (allowedKeys.has(fieldKey)) {
    return true;
  }
  return fieldKey.startsWith('fd.logo.') || fieldKey.startsWith('fd.hero.');
}

export function saveUploadedImage(
  fieldKey: string,
  buffer: Buffer,
  mimeType: string,
): string {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported image type. Use JPG, PNG, WEBP, or GIF.');
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  ensureUploadsDir();

  const safeKey = fieldKey.replace(/[^a-zA-Z0-9._-]/g, '-');
  const extension = MIME_EXTENSIONS[mimeType] ?? '.bin';
  const filename = `${safeKey}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  fs.writeFileSync(filepath, buffer);
  return `/api/media/${filename}`;
}

export function resolveMediaPath(filename: string): string | null {
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return null;
  }

  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return null;
  }

  return filepath;
}

export function getMimeTypeForFile(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

export function removeMediaUrl(url: string): void {
  if (!url.startsWith('/api/media/')) {
    return;
  }

  const filename = url.replace('/api/media/', '');
  const filepath = resolveMediaPath(filename);
  if (filepath && fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
