/**
 * Burnvelope Client-Side Encryption Utilities
 *
 * Uses Web Crypto API for AES-256-GCM encryption.
 * All encryption happens in the browser before data is sent to the server.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits for auth tag

/**
 * Generate a random encryption key
 * @returns Base64url-encoded key string
 */
export async function generateKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64url(rawKey);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @param keyBase64url - Base64url-encoded encryption key
 * @returns Base64-encoded ciphertext (IV + ciphertext)
 */
export async function encrypt(
  plaintext: string,
  keyBase64url: string
): Promise<string> {
  const key = await importKey(keyBase64url);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    data
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param ciphertextBase64 - Base64-encoded ciphertext (IV + ciphertext)
 * @param keyBase64url - Base64url-encoded encryption key
 * @returns Decrypted plaintext
 */
export async function decrypt(
  ciphertextBase64: string,
  keyBase64url: string
): Promise<string> {
  const key = await importKey(keyBase64url);
  const combined = base64ToArrayBuffer(ciphertextBase64);
  const combinedArray = new Uint8Array(combined);

  // Extract IV and ciphertext
  const iv = combinedArray.slice(0, IV_LENGTH);
  const ciphertext = combinedArray.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Import a Base64url-encoded key for use with Web Crypto
 */
async function importKey(keyBase64url: string): Promise<CryptoKey> {
  const rawKey = base64urlToArrayBuffer(keyBase64url);

  return crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to Base64url string (URL-safe, no padding)
 */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const base64 = arrayBufferToBase64(buffer);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert Base64url string to ArrayBuffer
 */
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  // Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return base64ToArrayBuffer(base64);
}

/**
 * Validate that a string is a valid Base64url-encoded key
 */
export function isValidKey(key: string): boolean {
  try {
    const buffer = base64urlToArrayBuffer(key);
    // AES-256 key should be 32 bytes
    return buffer.byteLength === 32;
  } catch {
    return false;
  }
}

/**
 * Get the key from the URL hash (fragment)
 * The hash is never sent to the server
 */
export function getKeyFromHash(): string | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;

  const key = hash.slice(1); // Remove the '#'
  return isValidKey(key) ? key : null;
}

/**
 * Create a shareable URL with the key in the hash
 */
export function createShareUrl(id: string, key: string): string {
  if (typeof window === 'undefined') {
    return `/view/${id}#${key}`;
  }
  const baseUrl = window.location.origin;
  return `${baseUrl}/view/${id}#${key}`;
}
