/**
 * Adversarial checks against a hosted-mode Worker (HYPEABLE_HOSTED=1).
 *
 * Runs in the `e2e:hosted` Playwright job. Set SECURITY_BASE_URL to aim it at
 * another hosted build (for example `vite preview` with HYPEABLE_HOSTED=1).
 *
 * SSRF probes point at a raw TCP canary on loopback, so any outbound attempt
 * counts as a hit no matter which scheme, host spelling, or provider made it.
 */
import { createServer, type Server, type Socket } from 'node:net';
import { expect, test, type APIRequestContext } from '@playwright/test';

const BASE = process.env.SECURITY_BASE_URL;

if (BASE) {
  test.use({ baseURL: BASE });
}

let canary: Server;
let canaryPort = 0;
let canaryHits = 0;

const sockets = new Set<Socket>();

test.beforeAll(async () => {
  canary = createServer((socket) => {
    canaryHits += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.destroy();
  });
  await new Promise<void>((resolve) => canary.listen(0, '127.0.0.1', resolve));
  canaryPort = (canary.address() as { port: number }).port;
});

test.afterAll(async () => {
  for (const socket of sockets) {
    socket.destroy();
  }

  await new Promise<void>((resolve) => canary.close(() => resolve()));
});

function originOf(baseURL: string | undefined): string {
  return new URL(baseURL ?? 'http://localhost:5173').origin;
}

function disguisedCanaryUrls(port: number): string[] {
  return [
    `http://127.0.0.1:${port}`,
    `https://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`,
    `http://[::ffff:127.0.0.1]:${port}`,
    `http://2130706433:${port}`,
    `http://0x7f000001:${port}`,
    `http://0177.0.0.1:${port}`,
    `http://127.1:${port}`,
    `https://api.openai.com@127.0.0.1:${port}`,
    `http://127.0.0.1:${port}#@api.openai.com`,
    `http://127.0.0.1:${port}/?@api.openai.com`,
    `HTTP://127.0.0.1:${port}`,
    ` http://127.0.0.1:${port}`,
    `http://127.0.0.1:${port}\\@api.openai.com`,
  ];
}

const URL_PROVIDERS = ['OpenAI', 'OpenAILike', 'Ollama', 'LMStudio', 'Together', 'Hyperbolic', 'Z.ai', 'Anthropic'];

function providersHeader(provider: string, baseUrl: string): string {
  return encodeURIComponent(JSON.stringify({ [provider]: { enabled: true, baseUrl } }));
}

/**
 * The Vite dev server's undici bridge sometimes answers a 500 "fetch failed"
 * before our handler runs. Retry once so that artifact cannot hide a real 2xx.
 */
async function postSettled(request: APIRequestContext, url: string, options: Parameters<APIRequestContext['post']>[1]) {
  const first = await request.post(url, options);

  return first.status() === 500 ? request.post(url, options) : first;
}

async function expectNoCanaryHit(run: () => Promise<void>) {
  const before = canaryHits;
  await run();
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(canaryHits - before, 'hosted Worker connected to the loopback canary').toBe(0);
}

test.describe('hosted attacks', () => {
  test('provider base URLs cannot reach loopback through any LLM route', async ({ request, baseURL }) => {
    test.setTimeout(240_000);

    const origin = originOf(baseURL);

    let ip = 0;

    await expectNoCanaryHit(async () => {
      for (const provider of URL_PROVIDERS) {
        for (const baseUrl of disguisedCanaryUrls(canaryPort)) {
          ip += 1;

          // Fresh client address per probe so the rate limiter never masks a reachable fetch.
          const headers = {
            Origin: origin,
            'Content-Type': 'application/json',
            'x-hypeable-providers': providersHeader(provider, baseUrl),
            'x-hypeable-key': encodeURIComponent(JSON.stringify({ [provider]: 'test-not-a-real-key' })),
            'cf-connecting-ip': `198.18.${Math.floor(ip / 250)}.${ip % 250}`,
          };

          const llm = await request.post('/api/llmcall', {
            headers,
            data: { message: 'hi', model: 'm', provider: { name: provider } },
          });
          expect([400, 401, 403], `llmcall ${provider} ${baseUrl}`).toContain(llm.status());

          const models = await request.get(`/api/models/${encodeURIComponent(provider)}`, { headers });
          expect(models.status(), `models ${provider} ${baseUrl}`).toBeLessThan(500);
        }

        const chat = await request.post('/api/chat', {
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'x-hypeable-providers': providersHeader(provider, `http://127.0.0.1:${canaryPort}`),
            'x-hypeable-key': encodeURIComponent(JSON.stringify({ [provider]: 'test-not-a-real-key' })),
          },
          data: {
            messages: [
              { id: '1', role: 'user', parts: [{ type: 'text', text: `[Model: m]\n\n[Provider: ${provider}]\n\nhi` }] },
            ],
          },
        });
        expect(chat.status(), `chat ${provider}`).not.toBe(200);
      }
    });
  });

  test('git proxy refuses hosts, encodings, ports and methods outside the allowlist', async ({ request }) => {
    const port = canaryPort;

    await expectNoCanaryHit(async () => {
      const paths = [
        `127.0.0.1:${port}/x/info/refs`,
        `localhost:${port}/x/info/refs`,
        `[::1]:${port}/x/info/refs`,
        `2130706433/x/info/refs`,
        `0x7f000001/x/info/refs`,
        `github.com@127.0.0.1:${port}/x/info/refs`,
        `github.com%40127.0.0.1:${port}/x/info/refs`,
        `github.com:${port}/x/info/refs`,
        `github.com.evil.example/x/info/refs`,
        `evil.github.com/x/info/refs`,
        `github.com%2F..%2F127.0.0.1/x`,
        `github.com\\@127.0.0.1/x`,
        `gitlab.com%23@127.0.0.1/x`,
        `api.github.com/repos/x/y/zipball`,
        `github.com/owner/repo/settings`,
        `github.com/owner/repo.git/info/refs?access_token=leak`,
      ];

      for (const path of paths) {
        const res = await request.get(`/api/git-proxy/${path}`);
        expect([400, 403, 404], `git-proxy ${path}`).toContain(res.status());
        expect(res.headers()['access-control-allow-origin']).toBeFalsy();
      }

      for (const method of ['PUT', 'DELETE', 'PATCH', 'PROPFIND']) {
        const res = await request.fetch('/api/git-proxy/github.com/owner/repo.git/info/refs', { method });
        expect([403, 404, 405], `git-proxy ${method}`).toContain(res.status());
      }

      // Node's HTTP stack refuses TRACE before routing, so only require that it never succeeds.
      const trace = await request.fetch('/api/git-proxy/github.com/owner/repo.git/info/refs', { method: 'TRACE' });
      expect(trace.status(), 'git-proxy TRACE').toBeGreaterThanOrEqual(400);
    });
  });

  test('every mutating API route rejects cross-site and origin-less requests', async ({ request }) => {
    const routes = [
      '/api/chat',
      '/api/llmcall',
      '/api/enhancer',
      '/api/github-user',
      '/api/github-branches',
      '/api/gitlab-projects',
      '/api/gitlab-branches',
      '/api/netlify-user',
      '/api/netlify-deploy',
      '/api/vercel-user',
      '/api/vercel-deploy',
      '/api/supabase',
      '/api/supabase/query',
      '/api/supabase/variables',
      '/api/web-search',
    ];

    for (const route of routes) {
      for (const origin of ['https://evil.example', 'null', 'http://localhost.evil.example']) {
        const res = await postSettled(request, route, {
          headers: { Origin: origin, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
          data: {},
        });
        expect([403, 404, 405], `${route} Origin=${origin}`).toContain(res.status());
        expect(res.headers()['access-control-allow-origin'], `${route} ACAO`).toBeFalsy();
      }

      const crossReferer = await postSettled(request, route, {
        headers: { Referer: 'https://evil.example/page', 'Content-Type': 'text/plain' },
        data: '{}',
      });
      expect([403, 404, 405], `${route} Referer`).toContain(crossReferer.status());

      const preflight = await request.fetch(route, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-hypeable-key',
        },
      });
      expect(preflight.headers()['access-control-allow-origin'], `${route} preflight ACAO`).toBeFalsy();
    }
  });

  test('API paths are canonicalised: casing, encoding and .data cannot dodge headers or buckets', async ({
    request,
    baseURL,
  }) => {
    for (const path of ['/API/health', '/Api/Health', '/%61pi/health', '/api/health/']) {
      const res = await request.get(path);
      expect(res.headers()['cache-control'], `${path} cache-control`).toContain('no-store');
      expect(res.headers()['x-content-type-options'], `${path} nosniff`).toBe('nosniff');
    }

    const origin = originOf(baseURL);

    const variants = [
      '/api/chat',
      '/API/chat',
      '/api/Chat',
      '/api/%63hat',
      '/%61pi/chat',
      '/api/chat/',
      '/api/chat.data',
    ];

    const statuses: number[] = [];

    for (let i = 0; i < 70; i += 1) {
      const res = await request.post(variants[i % variants.length], {
        headers: { Origin: origin, 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.77' },
        data: {},
      });
      statuses.push(res.status());
    }

    expect(statuses, 'path variants must share one /api/chat rate-limit bucket').toContain(429);
  });

  test('oversized and malformed bodies are refused cheaply', async ({ request, baseURL }) => {
    const origin = originOf(baseURL);
    const big = 'x'.repeat(2 * 1024 * 1024);

    const llm = await request.post('/api/llmcall', {
      headers: { Origin: origin, 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.90' },
      data: JSON.stringify({ message: big, model: 'm', provider: { name: 'OpenAI' } }),
    });
    expect([400, 413]).toContain(llm.status());

    const notJson = await request.post('/api/chat', {
      headers: { Origin: origin, 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.91' },
      data: '{"messages":[',
    });
    expect(notJson.status()).toBe(400);
    expect(await notJson.text()).not.toMatch(/at\s+\S+\s+\(|node_modules|\.ts:\d+/);

    const proto = await request.post('/api/llmcall', {
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'cf-connecting-ip': '198.51.100.92',
        'x-hypeable-providers': encodeURIComponent('{"__proto__":{"baseUrl":"http://127.0.0.1:1"}}'),
      },
      data: '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}},"message":"hi","model":"m","provider":{"name":"OpenAI"}}',
    });
    expect(proto.status()).toBeLessThan(500);
  });

  test('preview route only frames WebContainer preview ids', async ({ request }) => {
    for (const id of ['evil.example%2Fphish%3F', 'evil.example%23', 'a.b', 'x%40evil.example']) {
      const res = await request.get(`/webcontainer/preview/${id}`);
      expect(res.status(), `preview id ${id}`).toBe(404);
    }

    expect((await request.get('/webcontainer/preview/k03e2io1a8b7c6--5173--c8c182a3')).status()).toBe(200);
  });

  test('error responses never echo secrets or stack traces', async ({ request, baseURL }) => {
    const origin = originOf(baseURL);
    const fakeKey = 'sk-proj-' + 'A'.repeat(40);

    const res = await request.post('/api/llmcall', {
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'cf-connecting-ip': '198.51.100.93',
        'x-hypeable-key': encodeURIComponent(JSON.stringify({ OpenAI: fakeKey })),
      },
      data: { message: 'hi', model: 'definitely-not-a-model', provider: { name: 'NoSuchProvider' } },
    });

    const text = await res.text();
    expect(text).not.toContain(fakeKey);
    expect(text).not.toMatch(/at\s+\S+\s+\(|node_modules/);
  });
});
