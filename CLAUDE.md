# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Burnvelope is a secure one-time secret sharing application with end-to-end encryption. Secrets are encrypted client-side before being sent to the server, and decryption keys are stored only in the URL hash (never sent to the server).

## Commands

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

## Tech Stack

- **Framework**: Astro 5 with server-side rendering
- **Deployment**: Cloudflare Workers via `@astrojs/cloudflare` adapter
- **UI**: React 19 for interactive components, Astro components for static content
- **Storage**: Cloudflare KV for secret storage with TTL expiration
- **Encryption**: Web Crypto API (AES-256-GCM)

## Architecture

### Encryption Flow (Two-Layer)

1. **Client-side encryption** (`src/lib/crypto.ts`): Secrets are encrypted in the browser using AES-256-GCM before being sent to the API. The encryption key is stored in the URL hash fragment (never sent to server).

2. **Server-side encryption** (`src/pages/api/secrets.ts`): The already-encrypted data is encrypted again server-side using HKDF-derived keys from `ENCRYPTION_KEY` environment variable.

### Key Files

- `src/lib/crypto.ts` - Client-side encryption utilities (generateKey, encrypt, decrypt)
- `src/pages/api/secrets.ts` - POST endpoint to create secrets
- `src/pages/api/secrets/[id].ts` - GET endpoint to retrieve and delete secrets (one-time view)
- `src/components/CreateForm.tsx` - React form for creating secrets
- `src/components/ViewSecret.tsx` - React component for revealing secrets

### API Endpoints

- `POST /api/secrets` - Creates encrypted secret, returns `{id, expiresAt}`
- `GET /api/secrets/:id` - Retrieves and immediately deletes secret (one-time read)

### Cloudflare Configuration

- KV namespace `SECRETS` bound in `wrangler.toml`
- `ENCRYPTION_KEY` secret required (set via `wrangler secret put ENCRYPTION_KEY`)
- Secrets stored with TTL (1 minute to 7 days, default 24 hours)

## Path Alias

`@/*` maps to `src/*` (configured in tsconfig.json)
