// Simple sliding-window limiter. In-memory = fine for one instance / dev.
// On Vercel (many instances) use Upstash Redis or Vercel Firewall rate limits for real enforcement.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

export function clientIp(request: Request): string {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export function enforceRateLimit(request: Request, route: string, limit?: number, windowMs?: number) {
  if (!rateLimit(`${route}:${clientIp(request)}`, limit, windowMs))
    throw new Response('Too many requests', { status: 429, headers: { 'Retry-After': '60' } });
}
