/**
 * POST /api/secrets
 * Creates a new encrypted secret
 */

import type { APIContext } from 'astro';
import { nanoid } from 'nanoid';

interface CreateSecretRequest {
  encryptedData: string;
  expiresIn?: number;
}

interface CreateSecretResponse {
  id: string;
  expiresAt: string;
}

interface ErrorResponse {
  error: string;
}

// Expiration limits in seconds
const MIN_EXPIRATION = 60; // 1 minute
const MAX_EXPIRATION = 604800; // 7 days
const DEFAULT_EXPIRATION = 86400; // 24 hours

// Maximum payload size (100KB)
const MAX_PAYLOAD_SIZE = 100 * 1024;

export async function POST(context: APIContext): Promise<Response> {
  const { request, locals } = context;

  // Debug: log the structure of locals to find where bindings are
  const localsKeys = Object.keys(locals || {});
  const localsStructure = JSON.stringify(locals, (key, value) => {
    if (typeof value === 'function') return '[Function]';
    if (typeof value === 'object' && value !== null && value.constructor?.name === 'KvNamespace') return '[KVNamespace]';
    return value;
  }, 2);
  console.log('Locals keys:', localsKeys);
  console.log('Locals structure:', localsStructure);

  // Access Cloudflare runtime - try multiple possible locations
  const runtime = (locals as any).runtime ?? locals;
  const env = runtime?.env ?? runtime?.cf?.env ?? (locals as any).cf?.env ?? runtime;

  console.log('Runtime:', typeof runtime, Object.keys(runtime || {}));
  console.log('Env:', typeof env, Object.keys(env || {}));

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Validate environment bindings
    if (!env?.SECRETS) {
      console.error('KV namespace SECRETS not bound. Env keys:', Object.keys(env || {}));
      return jsonResponse<ErrorResponse>(
        { error: `Server configuration error: KV not bound. Debug: locals keys=[${localsKeys.join(',')}]` },
        500,
        corsHeaders
      );
    }

    if (!env?.ENCRYPTION_KEY) {
      console.error('ENCRYPTION_KEY not set');
      return jsonResponse<ErrorResponse>(
        { error: 'Server configuration error: encryption key not set' },
        500,
        corsHeaders
      );
    }

    // Parse request body
    const body: CreateSecretRequest = await request.json();

    // Validate encrypted data
    if (!body.encryptedData || typeof body.encryptedData !== 'string') {
      return jsonResponse<ErrorResponse>(
        { error: 'Missing or invalid encryptedData' },
        400,
        corsHeaders
      );
    }

    // Check payload size
    if (body.encryptedData.length > MAX_PAYLOAD_SIZE) {
      return jsonResponse<ErrorResponse>(
        { error: 'Payload too large' },
        413,
        corsHeaders
      );
    }

    // Validate expiration
    let expiresIn = body.expiresIn ?? DEFAULT_EXPIRATION;
    expiresIn = Math.max(MIN_EXPIRATION, Math.min(MAX_EXPIRATION, expiresIn));

    // Generate unique ID
    const id = nanoid(8);

    // Server-side encryption
    const serverEncrypted = await serverEncrypt(body.encryptedData, env.ENCRYPTION_KEY);

    // Store in KV with TTL
    const storageData = {
      data: serverEncrypted,
      createdAt: Date.now(),
    };

    await env.SECRETS.put(`secret:${id}`, JSON.stringify(storageData), {
      expirationTtl: expiresIn,
    });

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return jsonResponse<CreateSecretResponse>(
      { id, expiresAt },
      201,
      corsHeaders
    );
  } catch (error) {
    console.error('Error creating secret:', error);
    return jsonResponse<ErrorResponse>(
      { error: 'Failed to create secret' },
      500,
      corsHeaders
    );
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Server-side encryption using AES-GCM
 */
async function serverEncrypt(data: string, keyBase64: string): Promise<string> {
  const encoder = new TextEncoder();

  // Derive key from environment secret
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(keyBase64),
    'HKDF',
    false,
    ['deriveKey']
  );

  // Generate random salt for this secret
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: encoder.encode('burnvelope-server-encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoder.encode(data)
  );

  // Combine: salt (16) + iv (12) + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return arrayBufferToBase64(combined.buffer);
}

function jsonResponse<T>(data: T, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
