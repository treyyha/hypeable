/**
 * Same-origin check for state-changing connector/deploy routes.
 * Origin is caller-controlled only as a CSRF signal: it must match request.url.
 *
 * Local debug CORS (`Access-Control-Allow-Origin`) is only reflected for
 * loopback origins — never `*`.
 */

import { isPrivateOrLoopbackHost } from '~/lib/security/hosted';

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    return isPrivateOrLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * CORS headers for local-only debug routes. Hosted callers get nothing
 * (same-origin). A loopback Origin is reflected; `*` is never set.
 */
export function localDebugCorsHeaders(
  request: Request,
  extra?: { methods?: string; headers?: string; expose?: string },
): Record<string, string> {
  const origin = request.headers.get('Origin');

  if (!origin || !isLoopbackOrigin(origin)) {
    return {};
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': extra?.methods ?? 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': extra?.headers ?? 'Content-Type, Authorization',
  };

  if (extra?.expose) {
    headers['Access-Control-Expose-Headers'] = extra.expose;
  }

  return headers;
}

export function assertSameOrigin(request: Request): void {
  const expected = requestOrigin(request);
  const origin = request.headers.get('origin');

  if (origin) {
    if (origin !== expected) {
      throw forbidden();
    }

    return;
  }

  const referer = request.headers.get('referer');

  if (referer) {
    try {
      if (new URL(referer).origin !== expected) {
        throw forbidden();
      }
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }

      throw forbidden();
    }

    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw forbidden();
  }
}

function forbidden(): Response {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
