/**
 * Read BYO LLM keys from an LLM request. Keys arrive per-request in
 * `x-hypeable-key` (preferred) or a body `apiKeys` field. Cookies are ignored.
 */
import { safeJsonParse } from '~/lib/api/cookies';

export const HYPEABLE_KEY_HEADER = 'x-hypeable-key';

export const LLM_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

const LLM_ROUTE_PREFIXES = ['/api/chat', '/api/llmcall', '/api/enhancer', '/api/models'];

export function isLlmRoute(pathname: string): boolean {
  return LLM_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function asKeyMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, string> = {};

  for (const [name, key] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && key.length > 0) {
      out[name] = key;
    }
  }

  return out;
}

function parseHeaderPayload(raw: string): Record<string, string> {
  let decoded = raw;

  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  return asKeyMap(safeJsonParse<unknown>(decoded, {}));
}

/**
 * Keys for this request only. Never reads the `apiKeys` cookie — that cookie
 * used to ride along with every same-origin fetch, including static assets.
 */
export function getApiKeysFromRequest(request: Request, body?: unknown): Record<string, string> {
  const header = request.headers.get(HYPEABLE_KEY_HEADER);

  if (header) {
    const fromHeader = parseHeaderPayload(header);

    if (Object.keys(fromHeader).length > 0) {
      return fromHeader;
    }
  }

  if (body && typeof body === 'object' && body !== null && 'apiKeys' in body) {
    return asKeyMap((body as { apiKeys?: unknown }).apiKeys);
  }

  return {};
}

export function missingProviderKeyResponse(provider: string): Response {
  return Response.json(
    {
      error: true,
      message: 'Invalid or missing API key',
      statusCode: 401,
      isRetryable: false,
      provider,
    },
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...LLM_NO_STORE_HEADERS,
      },
    },
  );
}
