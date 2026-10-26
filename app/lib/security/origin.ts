/**
 * Same-origin check for state-changing connector/deploy routes.
 * Origin is caller-controlled only as a CSRF signal: it must match request.url.
 */

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
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
