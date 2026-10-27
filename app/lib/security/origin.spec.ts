import { describe, expect, it } from 'vitest';
import { assertSameOrigin, isLoopbackOrigin, localDebugCorsHeaders } from './origin';

function requestAt(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe('assertSameOrigin', () => {
  it('allows a matching Origin on POST', () => {
    expect(() =>
      assertSameOrigin(
        requestAt('https://hypeable.dev/api/vercel-deploy', {
          method: 'POST',
          headers: { Origin: 'https://hypeable.dev' },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a cross-origin POST', async () => {
    try {
      assertSameOrigin(
        requestAt('https://hypeable.dev/api/vercel-deploy', {
          method: 'POST',
          headers: { Origin: 'https://evil.example' },
        }),
      );
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }
  });

  it('rejects a mutating request with no Origin or Referer', async () => {
    try {
      assertSameOrigin(requestAt('https://hypeable.dev/api/netlify-deploy', { method: 'POST' }));
      expect.unreachable('should throw');
    } catch (error) {
      expect((error as Response).status).toBe(403);
    }
  });

  it('allows GET without Origin', () => {
    expect(() => assertSameOrigin(requestAt('https://hypeable.dev/api/vercel-deploy'))).not.toThrow();
  });
});

describe('localDebugCorsHeaders', () => {
  it('reflects a loopback Origin and never uses *', () => {
    const headers = localDebugCorsHeaders(
      requestAt('http://localhost:5173/api/system/diagnostics', {
        headers: { Origin: 'http://localhost:5173' },
      }),
    );

    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(headers.Vary).toBe('Origin');
    expect(Object.values(headers).join(' ')).not.toContain('*');
  });

  it('omits CORS headers for a public Origin or a missing Origin', () => {
    expect(
      localDebugCorsHeaders(
        requestAt('https://hypeable.dev/api/system/diagnostics', {
          headers: { Origin: 'https://evil.example' },
        }),
      ),
    ).toEqual({});
    expect(localDebugCorsHeaders(requestAt('http://localhost:5173/api/system/diagnostics'))).toEqual({});
    expect(isLoopbackOrigin('http://127.0.0.1:8788')).toBe(true);
    expect(isLoopbackOrigin('https://hypeable.dev')).toBe(false);
    expect(isLoopbackOrigin('null')).toBe(false);
  });
});
