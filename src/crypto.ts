import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const DEV_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.CMS_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }

  if (process.env.NODE_ENV !== 'production') {
    return Buffer.from(DEV_ENCRYPTION_KEY, 'hex');
  }

  throw new Error('CMS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
}

export function encryptPayload(payload: unknown): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

export function decryptPayload<T>(encryptedBlob: string): T {
  const key = getEncryptionKey();
  const parsed = JSON.parse(encryptedBlob) as { iv: string; tag: string; data: string };
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(parsed.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'hex')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}
