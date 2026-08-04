import nodemailer from 'nodemailer';

export function createMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getMailFromAddress(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@checkout.pe';
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
