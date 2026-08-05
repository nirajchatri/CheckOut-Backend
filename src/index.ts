import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import {
  CMS_IMAGE_KEYS,
  mergeCmsPayload,
  mergeFdRates,
  mergeSectionOrder,
} from './content/cmsDefaults.ts';
import { isSqlConfigured } from './db/config.ts';
import { insertEnquiry } from './db/enquiryStore.ts';
import { generateOtp, hashValue } from './crypto.ts';
import { createMailer, getMailConfigSummary, sendMail } from './mailer.ts';
import { registerGoogleAuthRoutes, USER_COOKIE_NAME } from './registerGoogleAuth.ts';
import { isGoogleOAuthConfigured } from './googleOAuth.ts';
import { upload } from './multer.ts';
import { getStorageMode, initializeStore, readContent, writeContent } from './store.ts';
import {
  getMimeTypeForFile,
  isAllowedImageField,
  removeMediaUrl,
  resolveMediaPath,
  saveUploadedImage,
} from './uploads.ts';

const PORT = Number(process.env.CMS_PORT ?? 3001);
const ADMIN_EMAIL = (process.env.CMS_ADMIN_EMAIL ?? 'nirajchatri@gmail.com').toLowerCase();
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const COOKIE_NAME = 'checkout_cms_session';
const OTP_TTL_MS = 10 * 60 * 1000;
const ENQUIRY_TO_EMAIL = (process.env.ENQUIRY_TO_EMAIL ?? 'niraj@checkout.pe').toLowerCase();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OtpRecord = {
  hash: string;
  expiresAt: number;
};

const otpStore = new Map<string, OtpRecord>();

function getJwtSecret(): string {
  if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'change-me-in-production') {
    throw new Error('JWT_SECRET must be set in production.');
  }
  return JWT_SECRET;
}

function formatEnquiryEmail(record: {
  name: string;
  email: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  message: string;
  enquiryId?: string;
}): string {
  const lines = [
    'New enquiry received on CheckOut.pe',
    record.enquiryId ? `Reference: ${record.enquiryId}` : '',
    '',
    `Name: ${record.name}`,
    `Email: ${record.email}`,
    `Mobile: ${record.mobile}`,
    `Address: ${record.address}`,
    `City: ${record.city}`,
    `State: ${record.state}`,
    `PIN: ${record.pin}`,
    '',
    'Message:',
    record.message,
  ];

  return lines.filter(Boolean).join('\n');
}

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { email?: string };
    if (payload.email?.toLowerCase() !== ADMIN_EMAIL) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: process.env.CMS_CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

registerGoogleAuthRoutes(app, {
  adminEmail: ADMIN_EMAIL,
  cmsCookieName: COOKIE_NAME,
  getJwtSecret,
  isProduction,
});

app.get('/api/health', async (_req, res) => {
  const mail = getMailConfigSummary();
  const payload: {
    ok: boolean;
    storage: ReturnType<typeof getStorageMode>;
    sqlConfigured: boolean;
    sqlConnected?: boolean;
    sqlError?: string;
    mail: ReturnType<typeof getMailConfigSummary> & { ready: boolean };
    googleOAuthConfigured: boolean;
  } = {
    ok: true,
    storage: getStorageMode(),
    sqlConfigured: isSqlConfigured(),
    mail: {
      ...mail,
      ready: mail.mode !== 'none',
    },
    googleOAuthConfigured: isGoogleOAuthConfigured(),
  };

  if (isSqlConfigured()) {
    try {
      const { getPool } = await import('./db/pool.ts');
      const pool = await getPool();
      await pool.request().query('SELECT 1 AS ok');
      payload.sqlConnected = true;
    } catch (error) {
      payload.ok = false;
      payload.sqlConnected = false;
      payload.sqlError = error instanceof Error ? error.message : 'SQL connection failed';
    }
  }

  res.status(payload.ok ? 200 : 503).json(payload);
});

app.get('/api/content', async (_req, res) => {
  try {
    const stored = await readContent();
    res.json({
      ...mergeCmsPayload(stored),
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    console.error('Failed to read content:', error);
    res.status(500).json({ error: 'Unable to load content.' });
  }
});

app.post('/api/auth/request-otp', async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();

  if (email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'This email is not authorized for CMS access.' });
    return;
  }

  const otp = generateOtp();
  otpStore.set(email, {
    hash: hashValue(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  const subject = 'CheckOut CMS login code';
  const text = `Your CheckOut CMS login code is ${otp}. It expires in 10 minutes.`;

  try {
    const mailer = await createMailer();
    if (mailer) {
      await sendMail(mailer, {
        to: email,
        subject,
        text,
      });
    } else {
      console.log(`[CMS OTP] ${email}: ${otp}`);
    }

    res.json({
      message: mailer
        ? 'OTP sent to your email.'
        : 'OTP generated (check server console in development).',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Failed to send OTP email:', error);
    res.status(500).json({
      error: 'Failed to send OTP email.',
      detail: process.env.NODE_ENV === 'production' ? undefined : detail,
    });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();
  const otp = String(req.body?.otp ?? '').trim();

  if (email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'This email is not authorized for CMS access.' });
    return;
  }

  const record = otpStore.get(email);
  if (!record || record.expiresAt < Date.now()) {
    otpStore.delete(email);
    res.status(400).json({ error: 'OTP expired or not requested.' });
    return;
  }

  if (hashValue(otp) !== record.hash) {
    res.status(400).json({ error: 'Invalid OTP' });
    return;
  }

  otpStore.delete(email);

  const token = jwt.sign({ email }, getJwtSecret(), { expiresIn: '8h' });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ message: 'Login successful.' });
});

app.post('/api/enquiry', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const mobile = String(req.body?.mobile ?? '').trim();
  const address = String(req.body?.address ?? '').trim();
  const city = String(req.body?.city ?? '').trim();
  const state = String(req.body?.state ?? '').trim();
  const pin = String(req.body?.pin ?? '').trim();
  const message = String(req.body?.message ?? '').trim();

  if (!name || !email || !mobile || !address || !city || !state || !pin || !message) {
    res.status(400).json({
      error: 'Name, email, mobile number, address, city, state, PIN, and message are required.',
    });
    return;
  }

  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  if (!/^\d{6}$/.test(pin)) {
    res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
    return;
  }

  if (
    name.length > 200 ||
    email.length > 320 ||
    mobile.length > 30 ||
    address.length > 500 ||
    city.length > 100 ||
    state.length > 100 ||
    pin.length > 10 ||
    message.length > 5000
  ) {
    res.status(400).json({ error: 'One or more fields exceed the allowed length.' });
    return;
  }

  if (!isSqlConfigured()) {
    res.status(503).json({ error: 'Enquiry storage is not configured. Please try again later.' });
    return;
  }

  const mailer = await createMailer();
  if (!mailer) {
    res.status(503).json({ error: 'Email service is not configured. Please try again later.' });
    return;
  }

  const ipAddress = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '')
    .split(',')[0]
    .trim();

  let enquiryId: string;

  try {
    enquiryId = await insertEnquiry({
      name,
      email,
      mobile,
      address,
      city,
      state,
      pin,
      message,
      ipAddress: ipAddress || undefined,
    });
  } catch (error) {
    console.error('Failed to save enquiry:', error);
    res.status(500).json({ error: 'Unable to save your enquiry. Please try again.' });
    return;
  }

  const enquiryDetails = formatEnquiryEmail({
    name,
    email,
    mobile,
    address,
    city,
    state,
    pin,
    message,
    enquiryId,
  });

  try {
    await sendMail(mailer, {
      to: ENQUIRY_TO_EMAIL,
      subject: `[CheckOut Enquiry] ${name}`,
      text: enquiryDetails,
      replyTo: email,
    });

    await sendMail(mailer, {
      to: email,
      subject: 'We received your enquiry — CheckOut.pe',
      text: [
        `Hi ${name},`,
        '',
        'Thank you for contacting CheckOut.pe. We have received your enquiry and our team will get back to you soon.',
        '',
        'Your submission:',
        `Name: ${name}`,
        `Email: ${email}`,
        `Mobile: ${mobile}`,
        `Address: ${address}`,
        `City: ${city}`,
        `State: ${state}`,
        `PIN: ${pin}`,
        '',
        'Message:',
        message,
        '',
        `Reference: ${enquiryId}`,
        '',
        '— CheckOut.pe Team',
      ].join('\n'),
    });
  } catch (error) {
    console.error('Failed to send enquiry email:', error);
    res.status(500).json({ error: 'Your enquiry was saved but email delivery failed. Our team has been notified.' });
    return;
  }

  res.json({
    message: 'Enquiry submitted successfully.',
    enquiryId,
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.clearCookie(USER_COOKIE_NAME);
  res.json({ message: 'Logged out.' });
});

app.get('/api/auth/me', authMiddleware, (_req, res) => {
  res.json({ email: ADMIN_EMAIL, authenticated: true });
});

app.put('/api/content', authMiddleware, async (req, res) => {
  const incomingContent = req.body?.content;
  const incomingFdRates = req.body?.fdRates;
  const incomingSections = req.body?.sections;
  const incomingSectionOrder = req.body?.sectionOrder;

  if (!incomingContent || typeof incomingContent !== 'object') {
    res.status(400).json({ error: 'Invalid content payload.' });
    return;
  }

  const previous = await readContent();
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(incomingContent)) {
    if (typeof value === 'string') {
      sanitized[key] = value;
    }
  }

  for (const key of CMS_IMAGE_KEYS) {
    const previousUrl = previous.content[key];
    const nextUrl = sanitized[key] ?? '';
    if (previousUrl && previousUrl !== nextUrl && previousUrl.startsWith('/api/media/')) {
      removeMediaUrl(previousUrl);
    }
  }

  try {
    const stored = {
      content: sanitized,
      fdRates: Array.isArray(incomingFdRates)
        ? mergeFdRates(incomingFdRates)
        : mergeFdRates(previous.fdRates),
      sections: incomingSections && typeof incomingSections === 'object'
        ? { ...previous.sections, ...incomingSections }
        : previous.sections,
      sectionOrder: Array.isArray(incomingSectionOrder)
        ? mergeSectionOrder(incomingSectionOrder)
        : mergeSectionOrder(previous.sectionOrder),
      updatedAt: new Date().toISOString(),
    };
    await writeContent(stored);
    res.json({
      ...mergeCmsPayload(stored),
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    console.error('Failed to save content:', error);
    res.status(500).json({ error: 'Unable to save content.' });
  }
});

app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const fieldKey = String(req.body?.fieldKey ?? req.query?.fieldKey ?? '').trim();
  const file = req.file;

  if (!fieldKey || !isAllowedImageField(fieldKey, CMS_IMAGE_KEYS)) {
    res.status(400).json({ error: 'Invalid image field key.' });
    return;
  }

  if (!file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }

  try {
    const stored = await readContent();
    const isFdBankImage = fieldKey.startsWith('fd.logo.') || fieldKey.startsWith('fd.hero.');
    const previous = isFdBankImage ? '' : stored.content[fieldKey];
    const url = saveUploadedImage(fieldKey, file.buffer, file.mimetype);

    if (previous && previous.startsWith('/api/media/') && previous !== url) {
      removeMediaUrl(previous);
    }

    if (!isFdBankImage) {
      stored.content[fieldKey] = url;
      stored.updatedAt = new Date().toISOString();
      await writeContent(stored);
    }

    res.json({
      url,
      fieldKey,
      ...mergeCmsPayload(stored),
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    console.error('Failed to upload image:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Unable to upload image.',
    });
  }
});

app.get('/api/media/:filename', (req, res) => {
  const filepath = resolveMediaPath(req.params.filename);
  if (!filepath) {
    res.status(404).json({ error: 'Image not found.' });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type(getMimeTypeForFile(req.params.filename));
  res.sendFile(filepath);
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Unexpected server error.' });
  },
);

async function startServer(): Promise<void> {
  try {
    await initializeStore();
  } catch (error) {
    console.error('Failed to initialize CMS storage:', error);
    if (isSqlConfigured()) {
      process.exit(1);
    }
  }

  const mailer = await createMailer();
  const mail = getMailConfigSummary();
  console.log(`Mail transport: ${mail.mode}${mailer ? '' : ' (OTP/enquiry emails disabled)'}`);

  app.listen(PORT, () => {
    console.log(`CheckOut CMS server running on http://localhost:${PORT}`);
    console.log(`CMS storage mode: ${getStorageMode()}`);
  });
}

void startServer();
