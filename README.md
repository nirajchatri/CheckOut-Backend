# CHECKOUT-Backend

CMS API and database layer for the CheckOut website. Handles authenticated admin access, encrypted content storage, image uploads, and SQL Server persistence.

## Prerequisites

- Node.js 18+
- SQL Server (optional — falls back to encrypted file storage in `data/content.enc`)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

   Generate a secure encryption key:

   ```bash
   openssl rand -hex 32
   ```

   Set `CMS_ENCRYPTION_KEY`, `JWT_SECRET`, Google OAuth (or SMTP) settings, and SQL Server credentials in `.env`.

3. **Google OAuth for email and sign-in** (recommended):

   - In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth 2.0 Web client.
   - Enable the **Gmail API**.
   - Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback` (and production: `https://api.checkout.pe/api/auth/google/callback`).
   - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_MAIL_USER` in `.env`.
   - Start the backend, then open `http://localhost:3001/api/auth/google/mail-setup` (or run `npm run google:oauth-setup` for instructions).
   - Copy `GOOGLE_REFRESH_TOKEN` from the callback page into `.env`.

   OTP emails, enquiry notifications, CMS admin OTP, and “Continue with Google” login use this configuration.

4. Initialize the database (when SQL Server is configured):

   ```bash
   npm run db:init
   ```

4. Start the API server:

   ```bash
   npm run dev
   ```

   API runs at [http://localhost:3001](http://localhost:3001).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start CMS API on port 3001 |
| `npm run db:init` | Create SQL schema and seed/migrate CMS data |
| `npm run sync:production` | Pull CMS + FD rates from production API into local storage |
| `npm run google:oauth-setup` | One-time Gmail OAuth refresh token setup |
| `npm run lint` | Type-check with TypeScript |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check and storage mode |
| GET | `/api/content` | No | Public CMS content |
| PUT | `/api/content` | Yes | Save CMS content |
| POST | `/api/upload` | Yes | Upload CMS images |
| GET | `/api/media/:filename` | No | Serve uploaded images |
| POST | `/api/auth/request-otp` | No | Request CMS login OTP (sent via Gmail OAuth or SMTP) |
| POST | `/api/auth/verify-otp` | No | Verify OTP and create session |
| GET | `/api/auth/google/mail-setup` | No | One-time Gmail send OAuth (returns refresh token page) |
| GET | `/api/auth/google` | No | Start Google OAuth (`purpose=admin` or `user`) |
| GET | `/api/auth/google/callback` | No | Google OAuth callback |
| GET | `/api/auth/user/me` | Cookie | Current user session (Google login) |
| POST | `/api/auth/logout` | No | Clear session |
| GET | `/api/auth/me` | Yes | Current admin session |

## Project Structure

```
src/
  index.ts          # Express API entry
  store.ts          # Storage facade (SQL or file)
  fileStore.ts      # Encrypted file fallback
  uploads.ts        # Image upload helpers
  crypto.ts         # Encryption + OTP helpers
  content/          # CMS defaults and merge helpers
  db/               # SQL Server pool, schema, CMS store
data/               # Encrypted content + uploads (gitignored)
sql/                # Reference SQL schema
```
