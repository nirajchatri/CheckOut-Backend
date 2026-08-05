import {
  createGoogleMailSetupUrl,
  getGoogleMailUser,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured,
} from './googleOAuth.ts';

async function main(): Promise<void> {
  if (!isGoogleOAuthConfigured()) {
    console.error(
      'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env first.',
    );
    process.exit(1);
  }

  const mailUser = getGoogleMailUser();
  if (!mailUser) {
    console.error('Set GOOGLE_MAIL_USER (or SMTP_USER) to the Gmail address that will send mail.');
    process.exit(1);
  }

  const port = process.env.CMS_PORT ?? '3001';
  const setupUrl = `http://localhost:${port}/api/auth/google/mail-setup`;

  console.log('\nGoogle OAuth setup for Gmail sending\n');
  console.log(`Redirect URI (must match Google Cloud Console): ${getGoogleRedirectUri()}`);
  console.log(`Sending mailbox: ${mailUser}\n`);
  console.log('1. Start the backend: npm run dev');
  console.log('2. Open this URL in your browser:\n');
  console.log(setupUrl);
  console.log(
    '\n3. After approval, copy GOOGLE_REFRESH_TOKEN from the callback page into .env.',
  );
  console.log('4. Restart the backend and verify GET /api/health shows mail.mode = "google-oauth".');
}

main().catch((error) => {
  console.error('Google OAuth setup failed:', error);
  process.exit(1);
});
