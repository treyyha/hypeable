import { describe, expect, it, vi } from 'vitest';
import { HYPEABLE_KEY_HEADER, getApiKeysFromRequest, missingProviderKeyResponse } from './request-keys';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

describe('getApiKeysFromRequest', () => {
  it('reads keys from x-hypeable-key and ignores the apiKeys cookie', () => {
    const headerValue = encodeURIComponent(JSON.stringify({ OpenAI: FAKE_KEY }));

    const request = new Request('https://example.com/api/llmcall', {
      method: 'POST',
      headers: {
        [HYPEABLE_KEY_HEADER]: headerValue,
        Cookie: `apiKeys=${encodeURIComponent(JSON.stringify({ OpenAI: 'sk-from-cookie-must-be-ignored-xx' }))}`,
      },
    });

    expect(getApiKeysFromRequest(request)).toEqual({ OpenAI: FAKE_KEY });
  });

  it('falls back to a body apiKeys field when the header is absent', () => {
    const request = new Request('https://example.com/api/enhancer', { method: 'POST' });

    expect(getApiKeysFromRequest(request, { apiKeys: { OpenAILike: FAKE_KEY } })).toEqual({
      OpenAILike: FAKE_KEY,
    });
  });

  it('returns an empty map when neither header nor body carries keys', () => {
    const request = new Request('https://example.com/api/chat', {
      headers: {
        Cookie: `apiKeys=${encodeURIComponent(JSON.stringify({ OpenAI: FAKE_KEY }))}`,
      },
    });

    expect(getApiKeysFromRequest(request)).toEqual({});
  });
});

describe('missingProviderKeyResponse', () => {
  it('returns a clean 401 that does not echo headers, cookies, or the key', async () => {
    const response = missingProviderKeyResponse('OpenAI');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      error: true,
      message: 'Invalid or missing API key',
      statusCode: 401,
      isRetryable: false,
      provider: 'OpenAI',
    });
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(body)).not.toContain('Cookie');
    expect(JSON.stringify(body)).not.toContain(HYPEABLE_KEY_HEADER);
  });
});

describe('POST /api/llmcall missing key', () => {
  it('returns a clean 401 and never prints the key', async () => {
    const { action } = await import('~/routes/api.llmcall');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const request = new Request('https://example.com/api/llmcall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `apiKeys=${encodeURIComponent(JSON.stringify({ OpenAI: FAKE_KEY }))}`,
      },
      body: JSON.stringify({
        message: 'hello',
        model: 'gpt-4o',
        provider: { name: 'OpenAI' },
      }),
    });

    const response = await action({
      request,
      context: { clientAddress: '10.0.0.8', cloudflare: { env: {} } },
      params: {},
    } as never);

    const body = (await response.json()) as { message?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.message).toBe('Invalid or missing API key');
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);

    const printed = [...spy.mock.calls, ...logSpy.mock.calls].flat().map(String).join(' ');
    expect(printed).not.toContain(FAKE_KEY);

    spy.mockRestore();
    logSpy.mockRestore();
  });
});
