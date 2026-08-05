import nodemailer from 'nodemailer';
import {
  getGoogleMailUser,
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

export async function createMailer(): Promise<nodemailer.Transporter | null> {
  if (cachedMailer !== undefined) {
    return cachedMailer;
  }

  cachedMode = resolveMailTransportMode();

  if (cachedMode === 'google-oauth') {
    cachedMailer = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: getGoogleMailUser(),
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });
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
  mailer: nodemailer.Transporter,
  options: SendMailOptions,
): Promise<void> {
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
    mode: cachedMode,
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    googleMailConfigured: isGoogleMailConfigured(),
  };
}

export function resetMailerCache(): void {
  cachedMailer = undefined;
  cachedMode = 'none';
}
