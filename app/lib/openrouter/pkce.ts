/**
 * PKCE S256 helpers for OpenRouter's OAuth key mint.
 *
 * Verifier is 32 random bytes (256-bit) as base64url (43 chars), matching
 * RFC 7636 and OpenRouter's documented example. Challenge is
 * base64url(SHA-256(verifier)) with padding stripped.
 */
const VERIFIER_BYTES = 32;
const UNRESERVED = /^[A-Za-z0-9\-._~]+$/;

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  let binary = '';

  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createCodeVerifier(randomBytes: (size: number) => Uint8Array = defaultRandomBytes): string {
  const verifier = bytesToBase64Url(randomBytes(VERIFIER_BYTES));

  if (verifier.length < 43 || verifier.length > 128 || !UNRESERVED.test(verifier)) {
    throw new Error('Could not generate a PKCE verifier.');
  }

  return verifier;
}

export async function createS256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(digest);
}

export function createPkceState(randomBytes: (size: number) => Uint8Array = defaultRandomBytes): string {
  return bytesToBase64Url(randomBytes(32));
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifier = createCodeVerifier();
  const challenge = await createS256Challenge(verifier);
  const state = createPkceState();

  return { verifier, challenge, state };
}

export function isValidVerifier(verifier: string): boolean {
  return verifier.length >= 43 && verifier.length <= 128 && UNRESERVED.test(verifier);
}

function defaultRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  return bytes;
}
