import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { envFromContext, hostFromContext, isHostedFromContext } from '~/lib/security/hosted';
import {
  GIT_SMART_HTTP_MAX_BYTES,
  GIT_SMART_HTTP_TIMEOUT_MS,
  assertGitProxyTarget,
  hostedOutboundResponse,
} from '~/lib/security/outbound';

// Allowed headers to forward to the target server
const ALLOW_HEADERS = [
  'accept-encoding',
  'accept-language',
  'accept',
  'access-control-allow-origin',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'dnt',
  'pragma',
  'range',
  'referer',
  'user-agent',
  'x-authorization',
  'x-http-method-override',
  'x-requested-with',
];

// Headers to expose from the target server's response
const EXPOSE_HEADERS = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'pragma',
  'server',
  'transfer-encoding',
  'vary',
  'x-github-request-id',
  'x-redirected-url',
];

// Handle all HTTP methods
export async function action({ request, params, context }: ActionFunctionArgs) {
  return handleProxyRequest(request, params['*'], context);
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  return handleProxyRequest(request, params['*'], context);
}

async function handleProxyRequest(request: Request, path: string | undefined, context?: unknown) {
  try {
    if (!path) {
      return Response.json({ error: 'Invalid proxy URL format' }, { status: 400 });
    }

    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': ALLOW_HEADERS.join(', '),
          'Access-Control-Expose-Headers': EXPOSE_HEADERS.join(', '),
          'Access-Control-Max-Age': '86400',
        },
      });
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

    // Filter and prepare headers
    const headers = new Headers();

    // Only forward allowed headers
    for (const header of ALLOW_HEADERS) {
      if (request.headers.has(header)) {
        headers.set(header, request.headers.get(header)!);
      }
    }

    // Set the host header
    headers.set('Host', domain);

    // Set Git user agent if not already present
    if (!headers.has('user-agent') || !headers.get('user-agent')?.startsWith('git/')) {
      headers.set('User-Agent', 'git/@isomorphic-git/cors-proxy');
    }

    /*
     * `duplex` is required by undici/Node when streaming a request body, but it is
     * absent from the Cloudflare `RequestInit` type, so widen it locally.
     */
    const hosted = isHostedFromContext(context);

    const fetchOptions: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'follow',
      signal: hosted ? AbortSignal.timeout(GIT_SMART_HTTP_TIMEOUT_MS) : request.signal,
    };

    // Add body for non-GET/HEAD requests
    if (!['GET', 'HEAD'].includes(request.method)) {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    // Forward the request to the target URL
    const response = await fetch(targetURL, fetchOptions);

    // Create response headers
    const responseHeaders = new Headers();

    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', ALLOW_HEADERS.join(', '));
    responseHeaders.set('Access-Control-Expose-Headers', EXPOSE_HEADERS.join(', '));

    // Copy exposed headers from the target response
    for (const header of EXPOSE_HEADERS) {
      // Skip content-length as we'll use the original response's content-length
      if (header === 'content-length') {
        continue;
      }

      if (response.headers.has(header)) {
        responseHeaders.set(header, response.headers.get(header)!);
      }
    }

    // If the response was redirected, add the x-redirected-url header
    if (response.redirected) {
      responseHeaders.set('x-redirected-url', response.url);
    }

    let body: ReadableStream<Uint8Array> | null = response.body;

    if (hosted && body) {
      const declared = Number(response.headers.get('content-length'));

      if (Number.isFinite(declared) && declared > GIT_SMART_HTTP_MAX_BYTES) {
        return Response.json({ error: 'Git proxy response too large' }, { status: 413 });
      }

      body = limitBytes(body, GIT_SMART_HTTP_MAX_BYTES);
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error');
    return Response.json(
      {
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
        url: path ? `https://${path}` : 'Invalid URL',
      },
      { status: 500 },
    );
  }
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
