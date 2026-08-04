import type { Request } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from './uploads.ts';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req: Request, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image uploads are allowed.'));
      return;
    }
    callback(null, true);
  },
});
