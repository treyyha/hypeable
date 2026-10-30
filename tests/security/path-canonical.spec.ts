/**
 * React Router resolves `/API/chat`, `/%61pi/chat`, `/api/chat/` and
 * `/api/chat.data` to the same action. Before canonicalisation each spelling
 * had its own rate-limit bucket and skipped the edge limiter, and mixed-case
 * paths skipped the Worker's API header pass entirely.
 */
import { describe, expect, it } from 'vitest';
import { withSecurity } from '~/lib/security';
import { canonicalPathname, isApiRequest } from '~/lib/security/headers';

const VARIANTS = [
  '/api/chat',
  '/API/chat',
  '/api/Chat',
  '/api/%63hat',
  '/%61pi/chat',
  '/api/chat/',
  '/api//chat',
  '/api/chat.data',
];

describe('canonicalPathname', () => {
  it('maps every spelling React Router accepts to one key', () => {
    for (const variant of VARIANTS) {
      expect(canonicalPathname(variant), variant).toBe('/api/chat');
    }
  });

  it('survives malformed escapes', () => {
    expect(canonicalPathname('/api/%E0%A4%A')).toBe('/api/%e0%a4%a');
    expect(canonicalPathname('/')).toBe('/');
    expect(canonicalPathname('')).toBe('/');
  });

  it('treats every variant as an API request so no-store/nosniff always apply', () => {
    for (const variant of [...VARIANTS, '/API/health', '/%61pi/health']) {
      expect(isApiRequest(new Request(`https://hypeable.dev${variant}`)), variant).toBe(true);
    }

    expect(isApiRequest(new Request('https://hypeable.dev/apiary'))).toBe(false);
    expect(isApiRequest(new Request('https://hypeable.dev/chat/abc'))).toBe(false);
  });
});

describe('withSecurity rate limit buckets', () => {
  async function post(path: string, ip: string, cloudflareLimiter?: (key: string) => boolean) {
    const handler = withSecurity(async () => new Response('ok'), { allowedMethods: ['POST'] });
    const request = new Request(`https://hypeable.dev${path}`, {
      method: 'POST',
      headers: { Origin: 'https://hypeable.dev' },
    });

    const context = {
      clientAddress: ip,
      cloudflare: cloudflareLimiter
        ? { env: { API_RATE_LIMITER: { limit: async ({ key }: { key: string }) => ({ success: cloudflareLimiter(key) }) } } }
        : undefined,
    };

    // The wrapper only reads request + context; params are unused.
    return handler({ request, context, params: {} } as unknown as Parameters<typeof handler>[0]);
  }

  it('path spellings share the /api/chat bucket', async () => {
    const ip = '203.0.113.200';
    const statuses: number[] = [];

    for (let i = 0; i < 61; i += 1) {
      statuses.push((await post(VARIANTS[i % VARIANTS.length], ip)).status);
    }

    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('sends every spelling of chat, llmcall and enhancer to the edge limiter under one key', async () => {
    const keys: string[] = [];
    const record = (key: string) => {
      keys.push(key);
      return true;
    };

    await post('/API/chat', '203.0.113.201', record);
    await post('/api/LLMCALL.data', '203.0.113.201', record);
    await post('/%61pi/enhancer/', '203.0.113.201', record);

    expect(keys).toEqual(['203.0.113.201:/api/chat', '203.0.113.201:/api/llmcall', '203.0.113.201:/api/enhancer']);
  });

  it('rate limits the enhancer', async () => {
    const ip = '203.0.113.202';
    let last = 0;

    for (let i = 0; i < 31; i += 1) {
      last = (await post('/api/enhancer', ip)).status;
    }

    expect(last).toBe(429);
  });
});
