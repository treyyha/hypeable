/**
 * /api/git-proxy is the one hosted route that fetches a user-chosen URL with
 * the user's git token, so pin what it forwards and where.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loader } from '~/routes/api.git-proxy.$';

type Call = { url: string; headers: Headers; method: string };

let ip = 0;

function proxy(path: string, headers: Record<string, string> = {}) {
  ip += 1;

  const request = new Request(`https://hypeable.dev/api/git-proxy/${path}`, {
    headers: {
      authorization: 'Basic dXNlcjp0b2tlbg==',
      cookie: 'session=abc',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
  });

  const context = { clientAddress: `203.0.113.${ip % 250}`, cloudflare: { env: { HYPEABLE_HOSTED: '1' } } };

  return loader({ request, context, params: { '*': path } } as never);
}

function mockUpstream(responses: Array<(url: string) => Response>) {
  const calls: Call[] = [];

  let index = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), headers: new Headers(init.headers), method: String(init.method) });

      const respond = responses[Math.min(index, responses.length - 1)];
      index += 1;

      return respond(String(url));
    }),
  );

  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('git proxy (hosted)', () => {
  it('forwards only git headers to an allowlisted host', async () => {
    const calls = mockUpstream([() => new Response('ok', { status: 200 })]);

    const res = await proxy('github.com/owner/repo.git/info/refs?service=git-upload-pack');

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).host).toBe('github.com');
    expect(calls[0].headers.get('authorization')).toBe('Basic dXNlcjp0b2tlbg==');
    expect(calls[0].headers.has('cookie')).toBe(false);
    expect(calls[0].headers.has('x-forwarded-for')).toBe(false);
  });

  it.each(['127.0.0.1/x/info/refs', 'evil.example/x/info/refs', 'github.com.evil.example/x/info/refs'])(
    'refuses %s without any outbound fetch',
    async (path) => {
      const calls = mockUpstream([() => new Response('ok')]);

      const res = await proxy(path);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(calls).toHaveLength(0);
    },
  );

  it('does not follow a redirect off the allowlist', async () => {
    const calls = mockUpstream([
      () => new Response(null, { status: 302, headers: { location: 'https://evil.example/steal' } }),
      () => new Response('ok'),
    ]);

    const res = await proxy('github.com/owner/repo.git/info/refs');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(calls.map((call) => new URL(call.url).host)).toEqual(['github.com']);
  });

  it('drops the git token when a redirect changes origin', async () => {
    const calls = mockUpstream([
      () => new Response(null, { status: 302, headers: { location: 'https://gitlab.com/owner/repo.git/info/refs' } }),
      () => new Response('ok', { status: 200 }),
    ]);

    const res = await proxy('github.com/owner/repo.git/info/refs', { 'x-authorization': 'token abc' });

    expect(res.status).toBe(200);
    expect(calls.map((call) => new URL(call.url).host)).toEqual(['github.com', 'gitlab.com']);
    expect(calls[1].headers.has('authorization')).toBe(false);
    expect(calls[1].headers.has('x-authorization')).toBe(false);
  });

  it('keeps the git token on a same-origin redirect', async () => {
    const calls = mockUpstream([
      () =>
        new Response(null, { status: 301, headers: { location: 'https://github.com/owner/renamed.git/info/refs' } }),
      () => new Response('ok', { status: 200 }),
    ]);

    await proxy('github.com/owner/repo.git/info/refs');

    expect(calls[1].headers.get('authorization')).toBe('Basic dXNlcjp0b2tlbg==');
  });
});
