import { describe, expect, it, vi } from 'vitest';
import { OPENROUTER_EXCHANGE_URL } from './constants';
import { exchangeOpenRouterCode } from './exchange';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenRouter code exchange', () => {
  it('POSTs code + verifier to OpenRouter and returns only the key', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { key: 'sk-or-e2e-mock', user_id: 'user_x' }));
    const result = await exchangeOpenRouterCode({ code: 'auth_code', verifier: 'v'.repeat(43) }, fetcher);

    expect(result).toEqual({ key: 'sk-or-e2e-mock' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENROUTER_EXCHANGE_URL);
    expect(init.method).toBe('POST');

    const sent = JSON.parse(String(init.body)) as Record<string, string>;
    expect(sent).toEqual({
      code: 'auth_code',
      code_verifier: 'v'.repeat(43),
      code_challenge_method: 'S256',
    });
  });

  it('maps a 403 to a plain error that does not include the code', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: 'Invalid code' } }));

    await expect(exchangeOpenRouterCode({ code: 'secret-code', verifier: 'v'.repeat(43) }, fetcher)).rejects.toThrow(
      /paste a key instead/i,
    );
  });
});
