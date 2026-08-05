import type express from 'express';
import jwt from 'jsonwebtoken';
import {
  buildFrontendRedirect,
  consumeOAuthState,
  createGoogleAuthUrl,
  createGoogleMailSetupUrl,
  exchangeGoogleAuthCode,
  isGoogleOAuthConfigured,
  sanitizeReturnTo,
  type GoogleAuthPurpose,
} from './googleOAuth.ts';

const USER_COOKIE_NAME = 'checkout_user_session';

type RegisterGoogleAuthOptions = {
  adminEmail: string;
  cmsCookieName: string;
  getJwtSecret: () => string;
  isProduction: boolean;
};

function setSessionCookie(
  res: express.Response,
  cookieName: string,
  payload: Record<string, string>,
  getJwtSecret: () => string,
  isProduction: boolean,
): void {
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function registerGoogleAuthRoutes(
  app: express.Express,
  options: RegisterGoogleAuthOptions,
): void {
  app.get('/api/auth/google/mail-setup', (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      res.status(503).json({ error: 'Google OAuth is not configured on the server.' });
      return;
    }

    try {
      const url = createGoogleMailSetupUrl();
      res.redirect(url);
    } catch (error) {
      console.error('Failed to start Google mail setup:', error);
      res.status(500).json({ error: 'Unable to start Gmail OAuth setup.' });
    }
  });

  app.get('/api/auth/google', (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      res.status(503).json({ error: 'Google OAuth is not configured on the server.' });
      return;
    }

    const purpose = String(req.query.purpose ?? 'user') as GoogleAuthPurpose;
    if (purpose !== 'admin' && purpose !== 'user') {
      res.status(400).json({ error: 'Invalid OAuth purpose.' });
      return;
    }

    const returnTo = sanitizeReturnTo(String(req.query.returnTo ?? (purpose === 'admin' ? '/admin' : '/')));

    try {
      const url = createGoogleAuthUrl({ purpose, returnTo });
      res.redirect(url);
    } catch (error) {
      console.error('Failed to start Google OAuth:', error);
      res.status(500).json({ error: 'Unable to start Google sign-in.' });
    }
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const error = String(req.query.error ?? '');
    const state = String(req.query.state ?? '');
    const code = String(req.query.code ?? '');

    const pending = consumeOAuthState(state);
    if (!pending) {
      res.redirect(buildFrontendRedirect('/login', { auth: 'error', reason: 'invalid_state' }));
      return;
    }

    if (error) {
      res.redirect(
        buildFrontendRedirect(pending.returnTo, { auth: 'error', reason: error || 'access_denied' }),
      );
      return;
    }

    if (!code) {
      res.redirect(buildFrontendRedirect(pending.returnTo, { auth: 'error', reason: 'missing_code' }));
      return;
    }

    try {
      const { profile, refreshToken } = await exchangeGoogleAuthCode(code);

      if (pending.mailSetup) {
        if (!refreshToken) {
          res.status(400).send(
            renderMailSetupPage({
              error:
                'No refresh token returned. Revoke CheckOut app access in your Google Account and try again.',
            }),
          );
          return;
        }

        res.send(
          renderMailSetupPage({
            email: profile.email,
            refreshToken,
          }),
        );
        return;
      }

      if (pending.purpose === 'admin') {
        if (profile.email !== options.adminEmail) {
          res.redirect(
            buildFrontendRedirect('/admin', {
              auth: 'error',
              reason: 'unauthorized_email',
            }),
          );
          return;
        }

        setSessionCookie(
          res,
          options.cmsCookieName,
          { email: profile.email, method: 'google' },
          options.getJwtSecret,
          options.isProduction,
        );
      } else {
        setSessionCookie(
          res,
          USER_COOKIE_NAME,
          {
            email: profile.email,
            name: profile.name,
            sub: profile.sub,
            method: 'google',
          },
          options.getJwtSecret,
          options.isProduction,
        );
      }

      res.redirect(buildFrontendRedirect(pending.returnTo, { auth: 'google_success' }));
    } catch (callbackError) {
      console.error('Google OAuth callback failed:', callbackError);
      res.redirect(
        buildFrontendRedirect(pending.returnTo, { auth: 'error', reason: 'oauth_exchange_failed' }),
      );
    }
  });

  app.get('/api/auth/user/me', (req, res) => {
    const token = req.cookies?.[USER_COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: 'Not signed in.' });
      return;
    }

    try {
      const payload = jwt.verify(token, options.getJwtSecret()) as {
        email?: string;
        name?: string;
        sub?: string;
      };

      if (!payload.email) {
        res.status(401).json({ error: 'Invalid session.' });
        return;
      }

      res.json({
        authenticated: true,
        email: payload.email,
        name: payload.name ?? payload.email,
        sub: payload.sub,
      });
    } catch {
      res.status(401).json({ error: 'Invalid or expired session.' });
    }
  });
}

function renderMailSetupPage(options: {
  email?: string;
  refreshToken?: string;
  error?: string;
}): string {
  if (options.error) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Google mail setup</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem;">
  <h1>Gmail OAuth setup failed</h1>
  <p style="color: #b91c1c;">${options.error}</p>
</body>
</html>`;
  }

  const token = options.refreshToken ?? '';
  const email = options.email ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Google mail setup</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem;">
  <h1>Gmail OAuth authorized</h1>
  <p>Account: <strong>${email}</strong></p>
  <p>Add this line to <code>CheckOut-Backend/.env</code>, then restart the backend:</p>
  <pre style="background: #f1f5f9; padding: 1rem; overflow-x: auto; border-radius: 8px;">GOOGLE_REFRESH_TOKEN=${token}</pre>
  <p>Verify with <code>GET /api/health</code> — <code>mail.mode</code> should be <code>"google-oauth"</code>.</p>
</body>
</html>`;
}

export { USER_COOKIE_NAME };
