// Secure session cookie: signed (HMAC-SHA256), HttpOnly, Secure, SameSite, short-lived.
// Only the session id/user id lives in the cookie. Everything else is looked up server-side.
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSessionCookie(userId: string, secret = process.env.SESSION_SECRET!, maxAgeSec = 60 * 60 * 24 * 7) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be 32+ chars');
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = `${userId}.${exp}`;
  const sig = await hmac(secret, payload);
  return `hy_session=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}

export async function readSession(request: Request, secret = process.env.SESSION_SECRET!): Promise<{ userId: string } | null> {
  const raw = /(?:^|;\s*)hy_session=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEqual(sig, await hmac(secret, payload))) return null;
  const [userId, exp] = payload.split('.');
  if (!userId || Number(exp) < Date.now() / 1000) return null;
  return { userId };
}

export const clearSessionCookie = 'hy_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
