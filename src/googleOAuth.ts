import crypto from 'crypto';
import { google } from 'googleapis';

export type GoogleAuthPurpose = 'admin' | 'user';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

type PendingOAuthState = {
  purpose: GoogleAuthPurpose;
  returnTo: string;
  mailSetup?: boolean;
  expiresAt: number;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const pendingOAuthStates = new Map<string, PendingOAuthState>();

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const USERINFO_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function getGoogleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `http://localhost:${process.env.CMS_PORT ?? 3001}/api/auth/google/callback`
  );
}

export function getGoogleMailUser(): string {
  return (process.env.GOOGLE_MAIL_USER ?? process.env.SMTP_USER ?? '').trim();
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      getGoogleRedirectUri(),
  );
}

export function isGoogleMailConfigured(): boolean {
  return Boolean(
    isGoogleOAuthConfigured() &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      getGoogleMailUser(),
  );
}

export function getFrontendOrigin(): string {
  const fromEnv = (process.env.CMS_CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return fromEnv[0] || 'http://localhost:3000';
}

export function sanitizeReturnTo(returnTo: string | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }
  return returnTo;
}

function createOAuthClient() {
  if (!isGoogleOAuthConfigured()) {
    throw new Error('Google OAuth is not configured.');
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(),
  );
}

export function getGoogleSignInScopes(purpose: GoogleAuthPurpose): string[] {
  if (purpose === 'admin') {
    return [...USERINFO_SCOPES];
  }
  return [...USERINFO_SCOPES];
}

export function getGoogleMailScopes(): string[] {
  return [GMAIL_SEND_SCOPE, ...USERINFO_SCOPES];
}

export function createGoogleAuthUrl(options: {
  purpose: GoogleAuthPurpose;
  returnTo?: string;
  scopes?: string[];
}): string {
  const oauth2Client = createOAuthClient();
  const state = crypto.randomBytes(24).toString('hex');
  const returnTo = sanitizeReturnTo(options.returnTo);

  pendingOAuthStates.set(state, {
    purpose: options.purpose,
    returnTo,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  });

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: options.scopes ?? getGoogleSignInScopes(options.purpose),
    state,
  });
}

export function createGoogleMailSetupUrl(): string {
  const oauth2Client = createOAuthClient();
  const state = crypto.randomBytes(24).toString('hex');

  pendingOAuthStates.set(state, {
    purpose: 'admin',
    returnTo: '/admin',
    mailSetup: true,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  });

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: getGoogleMailScopes(),
    state,
  });
}

export function consumeOAuthState(state: string): PendingOAuthState | null {
  const record = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);

  if (!record || record.expiresAt < Date.now()) {
    return null;
  }

  return record;
}

export async function exchangeGoogleAuthCode(code: string): Promise<{
  profile: GoogleProfile;
  refreshToken?: string;
  accessToken?: string;
}> {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  const email = (data.email ?? '').trim().toLowerCase();
  if (!email || !data.id) {
    throw new Error('Google account did not return a valid email address.');
  }

  return {
    profile: {
      sub: data.id,
      email,
      name: data.name ?? email,
      picture: data.picture ?? undefined,
    },
    refreshToken: tokens.refresh_token ?? undefined,
    accessToken: tokens.access_token ?? undefined,
  };
}

export async function getGoogleAccessToken(): Promise<string> {
  if (!isGoogleMailConfigured()) {
    throw new Error('Google mail OAuth is not configured.');
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token ?? undefined;

  if (!accessToken) {
    throw new Error('Unable to obtain Google access token for Gmail.');
  }

  return accessToken;
}

export function buildFrontendRedirect(
  returnTo: string,
  params: Record<string, string>,
): string {
  const url = new URL(returnTo, getFrontendOrigin());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
