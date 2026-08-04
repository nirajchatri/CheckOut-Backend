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

   Set `CMS_ENCRYPTION_KEY`, `JWT_SECRET`, SMTP settings, and SQL Server credentials in `.env`.

3. Initialize the database (when SQL Server is configured):

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
| `npm run lint` | Type-check with TypeScript |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check and storage mode |
| GET | `/api/content` | No | Public CMS content |
| PUT | `/api/content` | Yes | Save CMS content |
| POST | `/api/upload` | Yes | Upload CMS images |
| GET | `/api/media/:filename` | No | Serve uploaded images |
| POST | `/api/auth/request-otp` | No | Request login OTP |
| POST | `/api/auth/verify-otp` | No | Verify OTP and create session |
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
