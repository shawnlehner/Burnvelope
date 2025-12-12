# Burnvelope

**Secure one-time secret sharing with end-to-end encryption.**

Share passwords, API keys, and sensitive information securely. View once, then it's gone forever.

[burnvelope.com](https://burnvelope.com)

---

## About

Burnvelope is a privacy-focused tool for sharing sensitive information without leaving traces. Unlike emails, chat messages, or texts that persist indefinitely, Burnvelope secrets exist only until they're viewed—then they're permanently deleted.

More importantly, Burnvelope is designed so that **we can never read your secrets**. Even if our servers were compromised, even if we were compelled by law enforcement, we literally cannot access the plaintext of your data.

### The Problem

We've all been there. You need to share a password or API key with a colleague. What do you do? Email it? Slack it? These options all have the same fundamental problem: the message persists. It sits in inboxes and chat logs indefinitely, getting backed up, synced, and potentially exposed in data breaches.

### The Solution

Burnvelope takes a different approach. Instead of trying to secure persistent messages, we eliminate persistence entirely. Your secret exists only until it's viewed—then it's gone forever. And through our zero-knowledge architecture, we never have access to your plaintext data.

---

## Features

- **End-to-End Encryption** — Secrets are encrypted in your browser before leaving your device using AES-128-GCM
- **Zero-Knowledge Architecture** — The encryption key never touches our servers; it stays in the URL hash
- **One-Time Access** — Secrets are immediately and permanently deleted after viewing
- **Automatic Expiration** — Unviewed secrets expire after 1 hour to 7 days
- **Double Encryption** — Client-side encryption plus server-side encryption for defense in depth
- **No Account Required** — Create and share secrets instantly
- **Open Source** — Fully transparent, verify our security claims yourself

---

## How It Works

### Security Architecture

Burnvelope uses a two-layer encryption model:

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR BROWSER                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │   Secret    │ -> │ AES-128-GCM      │ -> │  Ciphertext   │  │
│  │  (plaintext)│    │ Encryption       │    │  + Key in URL │  │
│  └─────────────┘    │ (128-bit key)    │    └───────────────┘  │
│                     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (only ciphertext sent)
┌─────────────────────────────────────────────────────────────────┐
│                     BURNVELOPE SERVER                           │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Ciphertext  │ -> │ AES-256-GCM      │ -> │   Stored in   │  │
│  │ (encrypted) │    │ Encryption       │    │ Cloudflare KV │  │
│  └─────────────┘    │ (server key+HKDF)│    │   with TTL    │  │
│                     └──────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Why AES-128 for client-side encryption?** We use 128-bit keys for the client layer to keep URLs short and easy to share. AES-128 is still highly secure with no known practical attacks. The server adds a second layer of AES-256 encryption for defense in depth.

### The URL Hash Trick

The client-side encryption key is placed in the URL hash (the part after `#`):

```
https://burnvelope.com/view/abc123#YourSecretKeyHere
                                  └── never sent to server
```

By design, browsers **never send the hash fragment to the server**. This is a fundamental part of how URLs work. The key travels with the link but never touches our servers.

### What We Store

- Double-encrypted ciphertext (meaningless without both keys)
- Creation timestamp
- TTL expiration

### What We Never See

- Your plaintext secrets
- The client-side encryption keys
- IP addresses in access logs
- Any personally identifiable information

---

## Tech Stack

- **Framework**: [Astro](https://astro.build/) 5 with server-side rendering
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Storage**: [Cloudflare KV](https://developers.cloudflare.com/kv/) with native TTL expiration
- **UI Components**: [React](https://react.dev/) 19 for interactive forms
- **Encryption**: Web Crypto API (AES-128-GCM client, AES-256-GCM server, HKDF)
- **Language**: TypeScript

---

## Project Structure

```
src/
├── components/
│   ├── CreateForm.tsx      # React form for creating secrets
│   ├── ViewSecret.tsx      # React component for revealing secrets
│   ├── Layout.astro        # Page layout wrapper
│   ├── Header.astro        # Site header with navigation
│   ├── Footer.astro        # Site footer
│   └── ...                 # Additional UI components
├── lib/
│   └── crypto.ts           # Client-side encryption utilities
├── pages/
│   ├── index.astro         # Homepage with create form
│   ├── about.astro         # About page with security details
│   ├── view/
│   │   └── [id].astro      # Secret viewing page
│   └── api/
│       ├── secrets.ts      # POST endpoint - create secrets
│       └── secrets/
│           └── [id].ts     # GET endpoint - retrieve & delete secrets
└── styles/
    └── global.css          # Design system and global styles
```

---

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repository:

```bash
git clone https://github.com/shawnlehner/burnvelope.git
cd burnvelope
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:4321`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

---

## Deployment

Burnvelope is designed to run on Cloudflare Workers with Cloudflare KV for storage.

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Step 1: Create KV Namespace

Create a KV namespace to store encrypted secrets:

```bash
npx wrangler kv:namespace create "SECRETS"
```

Copy the returned namespace ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SECRETS"
id = "your-namespace-id-here"
```

### Step 2: Set Server Encryption Key

Generate a secure 32-byte encryption key and set it as a secret:

```bash
# Generate a random 32-byte key (base64 encoded)
openssl rand -base64 32

# Set the secret in Cloudflare
npx wrangler secret put ENCRYPTION_KEY
```

Paste your generated key when prompted.

### Step 3: Deploy

Deploy to Cloudflare Workers:

```bash
npm run build
npx wrangler deploy
```

### Configuration Reference

**wrangler.toml**:

```toml
name = "burnvelope"
compatibility_date = "2024-12-01"

[[kv_namespaces]]
binding = "SECRETS"
id = "your-namespace-id"
```

**Environment Variables**:

| Variable | Description | Required |
|----------|-------------|----------|
| `ENCRYPTION_KEY` | Server-side encryption key (32 bytes, base64) | Yes |

**KV Bindings**:

| Binding | Description |
|---------|-------------|
| `SECRETS` | KV namespace for storing encrypted secrets |

---

## API Reference

### Create Secret

```
POST /api/secrets
```

**Request Body:**

```json
{
  "encryptedData": "base64-encoded-ciphertext",
  "expiresIn": 86400
}
```

| Field | Type | Description |
|-------|------|-------------|
| `encryptedData` | string | Client-encrypted secret (base64) |
| `expiresIn` | number | TTL in seconds (60-604800, default: 86400) |

**Response:**

```json
{
  "id": "abc12345",
  "expiresAt": "2024-12-15T10:30:00.000Z"
}
```

### Retrieve Secret

```
GET /api/secrets/:id
```

**Response:**

```json
{
  "encryptedData": "base64-encoded-ciphertext"
}
```

The secret is **immediately deleted** after this request. Subsequent requests return 404.

**Error Responses:**

| Status | Description |
|--------|-------------|
| 404 | Secret not found or already viewed |
| 400 | Invalid secret ID |
| 500 | Server error |

---

## Security Considerations

### What Burnvelope Protects Against

- Secrets persisting in email/chat history
- Database breaches (encrypted data is useless without client keys)
- Server compromise (zero-knowledge architecture)
- Man-in-the-middle attacks (HTTPS + client-side encryption)

### What Burnvelope Does Not Protect Against

- Compromised recipient device
- Screenshots or copy/paste by recipient
- Shoulder surfing
- Malware on sender or recipient device
- Link interception before viewing (if attacker gets the full URL)

### Best Practices

- Share links through a different channel than you'd share the secret itself
- Use short expiration times when possible
- Verify the recipient received and viewed the secret
- For highly sensitive data, consider additional verification steps

---

## About the Creator

**Shawn Lehner**

I built Burnvelope because I was tired of the friction and risk involved in sharing sensitive information. As a developer, I frequently need to share API keys, credentials, and other secrets with team members—and I wanted a solution I could actually trust.

This project is a labor of love, built with security and privacy as the core principles. It's free, open source, and always will be.

[shawnlehner.com](https://www.shawnlehner.com/)

---

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
