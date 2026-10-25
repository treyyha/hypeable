// AES-256-GCM encryption for sensitive data at rest (WebCrypto, works in Node 20+, Workers, browsers).
// ENCRYPTION_KEY = 64 hex chars (32 bytes). Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Rotating? Prefix ciphertext with a key id (v1:) so old data stays readable.
const hex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(k = process.env.ENCRYPTION_KEY!) {
  if (!k || k.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars');
  return crypto.subtle.importKey('raw', hex(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(plain)));
  return `v1:${toB64(iv)}:${toB64(ct)}`;
}

export async function decrypt(token: string): Promise<string> {
  const [v, iv, ct] = token.split(':');
  if (v !== 'v1') throw new Error('unknown ciphertext version');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await key(), fromB64(ct)));
}
