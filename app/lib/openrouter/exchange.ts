/**
 * Browser exchange of an OpenRouter authorization code for a user-owned key.
 *
 * CORS on POST https://openrouter.ai/api/v1/auth/keys is `Access-Control-Allow-Origin: *`
 * (verified 2026-10-26), so this does not hop through Hypeable's server. The
 * key never touches our origin except as the user's own localStorage write.
 */
import { OPENROUTER_EXCHANGE_URL } from './constants';

export type ExchangeResult = { key: string };

const PLAIN_FAILURE = 'Could not finish connecting to OpenRouter. Paste a key instead.';

export async function exchangeOpenRouterCode(
  payload: { code: string; verifier: string },
  fetcher: typeof fetch = fetch,
): Promise<ExchangeResult> {
  let response: Response;

  try {
    response = await fetcher(OPENROUTER_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: payload.code,
        code_verifier: payload.verifier,
        code_challenge_method: 'S256',
      }),
    });
  } catch {
    throw new Error('Could not reach OpenRouter. Paste a key instead.');
  }

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(plainExchangeError(response.status));
  }

  const key = readKey(body);

  if (!key) {
    throw new Error(PLAIN_FAILURE);
  }

  return { key };
}

function readKey(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }

  const key = (body as { key?: unknown }).key;

  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

function plainExchangeError(status: number): string {
  if (status === 403) {
    return 'OpenRouter rejected this login. It may have expired — try Connect again, or paste a key instead.';
  }

  if (status === 400) {
    return 'OpenRouter could not complete this login. Try Connect again, or paste a key instead.';
  }

  return PLAIN_FAILURE;
}
