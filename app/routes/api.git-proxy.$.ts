import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { checkRateLimit } from '~/lib/security';
import { envFromContext, hostFromContext, isHostedFromContext } from '~/lib/security/hosted';
import { localDebugCorsHeaders } from '~/lib/security/origin';
import {
  GIT_PROXY_ALLOWED_METHODS,
  GIT_PROXY_EXPOSE_HEADERS,
  GIT_PROXY_FORWARD_REQUEST_HEADERS,
  GIT_PROXY_HOSTS,
  GIT_PROXY_MAX_REDIRECTS,
  GIT_SMART_HTTP_MAX_BYTES,
  GIT_SMART_HTTP_TIMEOUT_MS,
  assertGitProxyTarget,
  hostedOutboundResponse,
  resolveAllowlistedRedirect,
  shouldForwardGitProxyRequestHeader,
} from '~/lib/security/outbound';

export async function action({ request, params, context }: ActionFunctionArgs) {
  return handleProxyRequest(request, params['*'], context);
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  return handleProxyRequest(request, params['*'], context);
}

function corsHeaders(request: Request, hosted: boolean): Record<string, string> {
  if (hosted) {
    return {};
  }

  return localDebugCorsHeaders(request, {
    methods: GIT_PROXY_ALLOWED_METHODS.join(', '),
    headers: GIT_PROXY_FORWARD_REQUEST_HEADERS.join(', '),
    expose: GIT_PROXY_EXPOSE_HEADERS.join(', '),
  });
}

function methodNotAllowed(request: Request, hosted: boolean): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: GIT_PROXY_ALLOWED_METHODS.join(', '),
      ...corsHeaders(request, hosted),
    },
  });
}

async function handleProxyRequest(request: Request, path: string | undefined, context?: unknown) {
  const hosted = isHostedFromContext(context);
  const method = request.method.toUpperCase();

  if (!(GIT_PROXY_ALLOWED_METHODS as readonly string[]).includes(method)) {
    return methodNotAllowed(request, hosted);
  }

  const rate = checkRateLimit(request, '/api/git-proxy', context);

  if (rate.unavailable) {
    return new Response('Rate limiting requires trusted client IP configuration', { status: 503 });
  }

  if (!rate.allowed) {
    return Response.json(
      { error: true, message: 'Too many requests. Wait a minute, then try again.', statusCode: 429 },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil(((rate.resetTime ?? Date.now()) - Date.now()) / 1000).toString(),
          ...corsHeaders(request, hosted),
        },
      },
    );
  }

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Max-Age': '86400',
        ...corsHeaders(request, hosted),
      },
    });
  }

  try {
    if (!path) {
      return Response.json({ error: 'Invalid proxy URL format' }, { status: 400 });
    }

    const url = new URL(request.url);

    let targetURL: string;
    let domain: string;

    try {
      const target = assertGitProxyTarget(envFromContext(context), path, url.search, hostFromContext(context));
      targetURL = target.url;
      domain = target.host;
    } catch (error) {
      const rejected = hostedOutboundResponse(error);

      if (rejected) {
        return rejected;
      }

      return Response.json({ error: 'Invalid path format' }, { status: 400 });
    }

    const declared = Number(request.headers.get('content-length'));

    if (Number.isFinite(declared) && declared > GIT_SMART_HTTP_MAX_BYTES) {
      return Response.json({ error: 'Git proxy request too large' }, { status: 413 });
    }

    const headers = new Headers();

    request.headers.forEach((value, name) => {
      if (shouldForwardGitProxyRequestHeader(name)) {
        headers.set(name, value);
      }
    });

    headers.set('Host', domain);

    if (!headers.has('user-agent') || !headers.get('user-agent')?.startsWith('git/')) {
      headers.set('User-Agent', 'git/@isomorphic-git/cors-proxy');
    }

    const fetchOptions: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      redirect: 'manual',
      signal: hosted ? AbortSignal.timeout(GIT_SMART_HTTP_TIMEOUT_MS) : request.signal,
    };

    if (!['GET', 'HEAD'].includes(method)) {
      if (request.body) {
        fetchOptions.body = limitBytes(request.body, GIT_SMART_HTTP_MAX_BYTES);
        fetchOptions.duplex = 'half';
      }
    }

    const allowed = hosted ? GIT_PROXY_HOSTS : undefined;
    const { response, finalUrl } = await fetchGitProxy(targetURL, fetchOptions, allowed);

    const cors = corsHeaders(request, hosted);
    const responseHeaders = new Headers(cors);

    if (Object.keys(cors).length > 0) {
      responseHeaders.set('Access-Control-Allow-Methods', GIT_PROXY_ALLOWED_METHODS.join(', '));
      responseHeaders.set('Access-Control-Allow-Headers', GIT_PROXY_FORWARD_REQUEST_HEADERS.join(', '));
      responseHeaders.set('Access-Control-Expose-Headers', GIT_PROXY_EXPOSE_HEADERS.join(', '));
    }

    for (const header of GIT_PROXY_EXPOSE_HEADERS) {
      if (header === 'content-length' || header === 'x-redirected-url') {
        continue;
      }

      const value = response.headers.get(header);

      if (value) {
        responseHeaders.set(header, value);
      }
    }

    if (finalUrl !== targetURL) {
      responseHeaders.set('x-redirected-url', finalUrl);
    }

    let body: ReadableStream<Uint8Array> | null = response.body;

    if (hosted && body) {
      const responseLength = Number(response.headers.get('content-length'));

      if (Number.isFinite(responseLength) && responseLength > GIT_SMART_HTTP_MAX_BYTES) {
        await body.cancel().catch(() => undefined);

        return Response.json({ error: 'Git proxy response too large' }, { status: 413 });
      }

      body = limitBytes(body, GIT_SMART_HTTP_MAX_BYTES);
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    console.error('Proxy error');

    return Response.json({ error: 'Proxy error' }, { status: 502 });
  }
}

async function fetchGitProxy(
  startUrl: string,
  init: RequestInit & { duplex?: 'half' },
  allowed: readonly string[] | undefined,
): Promise<{ response: Response; finalUrl: string }> {
  let current = startUrl;

  for (let hop = 0; hop <= GIT_PROXY_MAX_REDIRECTS; hop++) {
    const response = await fetch(current, init);

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current };
    }

    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);

    if (!location || hop === GIT_PROXY_MAX_REDIRECTS) {
      return { response, finalUrl: current };
    }

    const previous = current;

    if (allowed) {
      current = resolveAllowlistedRedirect(current, location, allowed).href;
    } else {
      const next = new URL(location, current);

      if (next.protocol !== 'https:' || next.username || next.password) {
        throw new Error('disallowed redirect');
      }

      current = next.href;
    }

    const keepMethod = response.status === 307 || response.status === 308;
    const headers = new Headers(init.headers);

    // Same rule as fetch(): a token for one host must not follow a redirect to another.
    if (new URL(current).origin !== new URL(previous).origin) {
      headers.delete('authorization');
      headers.delete('x-authorization');
    }

    init = {
      ...init,
      headers,
      method: keepMethod ? init.method : 'GET',
      body: keepMethod ? init.body : undefined,
      duplex: keepMethod ? init.duplex : undefined,
    };
  }

  throw new Error('too many redirects');
}

function limitBytes(stream: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let seen = 0;

  const reader = stream.getReader();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        controller.close();
        return;
      }

      seen += value.byteLength;

      if (seen > maxBytes) {
        await reader.cancel();
        controller.error(new Error('Git proxy response too large'));

        return;
      }

      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
