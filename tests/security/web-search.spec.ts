/**
 * /api/web-search makes our Worker call DuckDuckGo, so a cross-site page must
 * not be able to spend it, and the outbound call must not carry the caller.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { action } from '~/routes/api.web-search';
import { WEB_SEARCH_CLAIM } from '~/utils/privacy-copy';

const ORIGIN = 'http://localhost:5173';
const RESULT_HTML =
  '<div class="result"><a class="result__a" href="https://vite.dev/guide/">Vite guide</a>' +
  '<a class="result__snippet">Getting started</a></div>';

function post(headers: Record<string, string>, body: unknown = { operation: 'search', query: 'vite docs' }) {
  const request = new Request(`${ORIGIN}/api/web-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers },
    body: JSON.stringify(body),
  });

  return action({ request, context: {}, params: {} } as never);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/api/web-search', () => {
  it('rejects a cross-site origin before any outbound call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await post({ origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a cross-site referer when Origin is absent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await post({ referer: 'https://evil.example/page' });

    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('searches same-origin and sends only the query to DuckDuckGo', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(RESULT_HTML, { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const response = await post({ origin: ORIGIN, cookie: 'session=abc', authorization: 'Bearer x' });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [target, init] = fetchSpy.mock.calls[0] as unknown as [URL, RequestInit];
    expect(new URL(String(target)).hostname).toBe('html.duckduckgo.com');

    const sent = new Headers(init.headers);

    for (const name of ['cookie', 'authorization', 'cf-connecting-ip', 'x-forwarded-for', 'origin', 'referer']) {
      expect(sent.has(name), name).toBe(false);
    }
  });

  it('is disclosed on /privacy', () => {
    expect(WEB_SEARCH_CLAIM).toMatch(/DuckDuckGo/);
    expect(WEB_SEARCH_CLAIM).toMatch(/do not store or log/);
  });
});
