import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import {
  getGoogleMailUser,
  getGoogleRedirectUri,
  isGoogleMailConfigured,
  isGoogleOAuthConfigured,
} from './googleOAuth.ts';

export type MailTransportMode = 'google-oauth' | 'smtp' | 'none';

let cachedMailer: nodemailer.Transporter | null | undefined;
let cachedMode: MailTransportMode = 'none';

export function getMailTransportMode(): MailTransportMode {
  return cachedMode;
}

function resolveMailTransportMode(): MailTransportMode {
  if (isGoogleMailConfigured()) {
    return 'google-oauth';
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    return 'smtp';
  }

  return 'none';
}

function createGmailOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(),
  );
}

function encodeGmailRawMessage(options: {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}): string {
  const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const lines = [
    `From: ${options.from}`,
    `To: ${to}`,
    `Subject: ${options.subject}`,
  ];

  if (options.replyTo) {
    lines.push(`Reply-To: ${options.replyTo}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=UTF-8');
  lines.push('');
  lines.push(options.text);

  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendMailViaGmailApi(options: SendMailOptions): Promise<void> {
  const oauth2Client = createGmailOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const raw = encodeGmailRawMessage({
    from: getMailFromAddress(),
    to: options.to,
    subject: options.subject,
    text: options.text,
    replyTo: options.replyTo,
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

export function formatMailErrorHint(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error);

  if (/invalid_grant|token has been expired or revoked/i.test(message)) {
    return 'Google refresh token is invalid or revoked. Open /api/auth/google/mail-setup and update GOOGLE_REFRESH_TOKEN.';
  }

  if (/insufficient|403|Forbidden|gmail\.send/i.test(message)) {
    return 'Gmail send permission missing. Re-authorize via /api/auth/google/mail-setup (not regular Google sign-in).';
  }

  if (/Mail service not enabled|Gmail API has not been used/i.test(message)) {
    return 'Enable the Gmail API in Google Cloud Console for this project.';
  }

  return undefined;
}

export async function verifyGoogleMailAccess(): Promise<void> {
  if (!isGoogleMailConfigured()) {
    return;
  }

  const oauth2Client = createGmailOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token ?? undefined;

  if (!accessToken) {
    throw new Error('Unable to obtain Google access token for Gmail.');
  }
}

export async function createMailer(): Promise<nodemailer.Transporter | null> {
  if (cachedMailer !== undefined) {
    return cachedMailer;
  }

  cachedMode = resolveMailTransportMode();

  if (cachedMode === 'google-oauth') {
    cachedMailer = null;
    return cachedMailer;
  }

  if (cachedMode === 'smtp') {
    const port = Number(process.env.SMTP_PORT ?? 587);
    cachedMailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return cachedMailer;
  }

  cachedMailer = null;
  return cachedMailer;
}

export function getMailFromAddress(): string {
  if (process.env.SMTP_FROM) {
    return process.env.SMTP_FROM;
  }

  const googleUser = getGoogleMailUser();
  if (googleUser) {
    return `CheckOut.pe <${googleUser}>`;
  }

  return process.env.SMTP_USER ?? 'noreply@checkout.pe';
}

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendMail(
  mailer: nodemailer.Transporter | null,
  options: SendMailOptions,
): Promise<void> {
  const mode = cachedMode !== 'none' ? cachedMode : resolveMailTransportMode();

  if (mode === 'google-oauth') {
    await sendMailViaGmailApi(options);
    return;
  }

  if (!mailer) {
    throw new Error('Mail transport is not configured.');
  }

  await mailer.sendMail({
    from: getMailFromAddress(),
    to: options.to,
    subject: options.subject,
    text: options.text,
    replyTo: options.replyTo,
  });
}

export function getMailConfigSummary(): {
  mode: MailTransportMode;
  googleOAuthConfigured: boolean;
  googleMailConfigured: boolean;
} {
  return {
    mode: cachedMode !== 'none' ? cachedMode : resolveMailTransportMode(),
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    googleMailConfigured: isGoogleMailConfigured(),
  };
}

export function resetMailerCache(): void {
  cachedMailer = undefined;
  cachedMode = 'none';
}
