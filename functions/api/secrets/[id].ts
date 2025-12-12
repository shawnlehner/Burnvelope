/**
 * GET /api/secrets/:id
 * Retrieves and deletes a secret (one-time view)
 */

interface Env {
  SECRETS: KVNamespace;
  ENCRYPTION_KEY: string;
}

interface StoredSecret {
  data: string;
  createdAt: number;
}

interface GetSecretResponse {
  encryptedData: string;
}

interface ErrorResponse {
  error: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const id = params.id as string;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Validate ID format
    if (!id || id.length < 6 || id.length > 12) {
      return jsonResponse<ErrorResponse>(
        { error: 'Invalid secret ID' },
        400,
        corsHeaders
      );
    }

    const key = `secret:${id}`;

    // Retrieve secret from KV
    const stored = await env.SECRETS.get(key);

    if (!stored) {
      return jsonResponse<ErrorResponse>(
        { error: 'Secret not found or already viewed' },
        404,
        corsHeaders
      );
    }

    // Parse stored data
    const secretData: StoredSecret = JSON.parse(stored);

    // Delete immediately (one-time use)
    await env.SECRETS.delete(key);

    // Decrypt server-side encryption
    const clientEncrypted = await serverDecrypt(secretData.data, env.ENCRYPTION_KEY);

    return jsonResponse<GetSecretResponse>(
      { encryptedData: clientEncrypted },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('Error retrieving secret:', error);
    return jsonResponse<ErrorResponse>(
      { error: 'Failed to retrieve secret' },
      500,
      corsHeaders
    );
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

/**
 * Server-side decryption using AES-GCM
 */
async function serverDecrypt(encryptedData: string, keyBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Decode combined data
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedData));

  // Extract: salt (16) + iv (12) + ciphertext
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  // Derive key from environment secret
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(keyBase64),
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive decryption key using same salt
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
    ['decrypt']
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
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
