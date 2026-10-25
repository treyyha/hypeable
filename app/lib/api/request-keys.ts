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

/**
 * Workerd's Headers is case-insensitive for `get()`, but incoming values may
 * already be URI-decoded (Node undici leaves the raw percent-encoding). Try
 * JSON first, then decodeURIComponent. Scan entries if `get()` misses.
 */
export function getHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const direct = headers.get(name);

  if (direct) {
    return direct;
  }

  const wanted = name.toLowerCase();

  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === wanted && value) {
      return value;
    }
  }

  return null;
}

export function readEncodedJsonHeader(headers: Headers, name: string): unknown {
  const raw = getHeaderCaseInsensitive(headers, name);

  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = safeJsonParse<unknown>(trimmed, undefined);

    if (parsed !== undefined) {
      return parsed;
    }
  }

  let decoded = raw;

  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  return safeJsonParse<unknown>(decoded, undefined);
}

/**
 * Keys for this request only. Never reads the `apiKeys` cookie — that cookie
 * used to ride along with every same-origin fetch, including static assets.
 */
export function getApiKeysFromRequest(request: Request, body?: unknown): Record<string, string> {
  const fromHeader = asKeyMap(readEncodedJsonHeader(request.headers, HYPEABLE_KEY_HEADER));

  if (Object.keys(fromHeader).length > 0) {
    return fromHeader;
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
