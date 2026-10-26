import { describe, expect, it } from 'vitest';
import { assertSameOrigin } from './origin';

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
