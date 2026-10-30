import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { isLlmRoute, LLM_NO_STORE_HEADERS } from '~/lib/api/request-keys';
import { canonicalPathname } from '~/lib/security/headers';
import { assertSameOrigin } from '~/lib/security/origin';
import { installSafeConsole, redactUnknown } from '~/lib/security/redact';

installSafeConsole();

// Rate limiting store (in-memory for serverless environments)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  // LLM streaming and call APIs (most restrictive)
  '/api/chat': { windowMs: 60 * 1000, maxRequests: 60 }, // 60 requests per minute
  '/api/llmcall': { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per minute
  '/api/enhancer': { windowMs: 60 * 1000, maxRequests: 30 },
  '/api/git-proxy': { windowMs: 60 * 1000, maxRequests: 60 },

  // GitHub API endpoints
  '/api/github-*': { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per minute

  // Publish / connector proxies (user token, user's account)
  '/api/netlify-*': { windowMs: 60 * 1000, maxRequests: 20 },
  '/api/vercel-*': { windowMs: 60 * 1000, maxRequests: 20 },
  '/api/gitlab-*': { windowMs: 60 * 1000, maxRequests: 20 },
  '/api/supabase': { windowMs: 60 * 1000, maxRequests: 20 },

  // General API endpoints fallback
  '/api/*': { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
};

/**
 * Rate limiting middleware
 */
export function checkRateLimit(
  request: Request,
  endpoint: string,
  context?: unknown,
): { allowed: boolean; resetTime?: number; unavailable?: boolean } {
  const clientIP = getTrustedClientIP(request, context);

  if (!clientIP) {
    return { allowed: false, unavailable: true };
  }

  const key = `${clientIP}:${endpoint}`;

  // Find matching rate limit rule: exact match first, then specific prefix, then generic wildcard
  const entries = Object.entries(RATE_LIMITS);

  const rule =
    entries.find(([pattern]) => pattern === endpoint) ||
    entries.find(([pattern]) => {
      if (pattern.endsWith('*') && !pattern.endsWith('/*')) {
        const basePattern = pattern.slice(0, -1);
        return endpoint.startsWith(basePattern);
      }

      return false;
    }) ||
    entries.find(([pattern]) => {
      if (pattern.endsWith('/*')) {
        const basePattern = pattern.slice(0, -2);
        return endpoint.startsWith(basePattern);
      }

      return false;
    });

  if (!rule) {
    return { allowed: true }; // No rate limit for this endpoint
  }

  const [, config] = rule;
  const now = Date.now();

  // Clean up old entries periodically to avoid O(N) cost on every single request
  if (rateLimitStore.size > 200) {
    for (const [storedKey, data] of rateLimitStore.entries()) {
      if (data.resetTime < now) {
        rateLimitStore.delete(storedKey);
      }
    }
  }

  // Get or create rate limit data
  const existing = rateLimitStore.get(key);

  const rateLimitData =
    existing && existing.resetTime > now ? existing : { count: 0, resetTime: now + config.windowMs };

  if (rateLimitData.count >= config.maxRequests) {
    return { allowed: false, resetTime: rateLimitData.resetTime };
  }

  // Update rate limit data
  rateLimitData.count++;
  rateLimitStore.set(key, rateLimitData);

  return { allowed: true };
}

/** Routes that relay to a model provider also go through the shared edge limiter. */
const EDGE_LIMITED_ENDPOINTS = new Set(['/api/chat', '/api/llmcall', '/api/enhancer']);

type CloudflareRateLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

/**
 * Optional Workers Rate Limiting binding. Pages Functions do not document this
 * binding; when it is absent we keep the in-memory limiter only.
 */
async function checkCloudflareRateLimit(context: unknown, endpoint: string, ip: string): Promise<boolean> {
  const limiter = (context as { cloudflare?: { env?: { API_RATE_LIMITER?: CloudflareRateLimiter } } } | undefined)
    ?.cloudflare?.env?.API_RATE_LIMITER;

  if (!limiter || typeof limiter.limit !== 'function') {
    return true;
  }

  try {
    const { success } = await limiter.limit({ key: `${ip}:${endpoint}` });
    return success;
  } catch {
    return true;
  }
}

/**
 * Get client IP address from request
 */
export function getTrustedClientIP(request: Request, context?: unknown): string | undefined {
  const runtimeContext = context as
    { clientAddress?: string; cloudflare?: { ctx?: { waitUntil?: unknown } } } | undefined;

  const adapterClientAddress = runtimeContext?.clientAddress;

  if (adapterClientAddress) {
    return normalizeIpAddress(adapterClientAddress);
  }

  const cloudflare = runtimeContext?.cloudflare;

  if (cloudflare?.ctx && typeof cloudflare.ctx.waitUntil === 'function') {
    return normalizeIpAddress(request.headers.get('cf-connecting-ip'));
  }

  /*
   * Only trust this header when an operator has configured a reverse proxy to
   * overwrite it and blocked direct access to the application origin.
   */
  if (process.env.BUG_REPORT_TRUSTED_IP_HEADER === 'x-real-ip') {
    return normalizeIpAddress(request.headers.get('x-real-ip'));
  }

  return undefined;
}

function normalizeIpAddress(value: string | null): string | undefined {
  const address = value?.trim();

  if (!address || address.includes(',')) {
    return undefined;
  }

  const ipv4 = address.split('.');

  if (ipv4.length === 4 && ipv4.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)) {
    return address;
  }

  try {
    return new URL(`http://[${address}]/`).hostname.slice(1, -1);
  } catch {
    return undefined;
  }
}

/**
 * Security headers middleware
 */
export function createSecurityHeaders() {
  return {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Content Security Policy - restrict to same origin and trusted sources
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for React
      "style-src 'self' 'unsafe-inline'", // Allow inline styles
      "img-src 'self' data: https: blob:", // Allow images from same origin, data URLs, and HTTPS
      "font-src 'self' data:", // Allow fonts from same origin and data URLs
      "connect-src 'self' https://api.github.com https://api.netlify.com", // Allow connections to GitHub and Netlify APIs
      "frame-src 'none'", // Prevent iframe embedding
      "object-src 'none'", // Prevent object embedding
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy (formerly Feature Policy)
    'Permissions-Policy': ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()'].join(', '),

    // HSTS (HTTP Strict Transport Security) - only in production
    ...(process.env.NODE_ENV === 'production'
      ? {
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        }
      : {}),
  };
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKeyFormat(apiKey: string, provider: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Basic length checks for different providers
  const minLengths: Record<string, number> = {
    anthropic: 50,
    openai: 50,
    groq: 50,
    google: 30,
    github: 30,
    netlify: 30,
  };

  const minLength = minLengths[provider.toLowerCase()] || 20;

  return apiKey.length >= minLength && !apiKey.includes('your_') && !apiKey.includes('here');
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: unknown, isDevelopment = false): string {
  if (isDevelopment) {
    // Still redact: a provider SDK error can embed the key in a URL or header dump.
    return redactUnknown(error instanceof Error ? error.message : String(error));
  }

  // In production, show generic messages to prevent information leakage
  if (error instanceof Error) {
    // Check for sensitive information in error messages
    if (error.message.includes('API key') || error.message.includes('token') || error.message.includes('secret')) {
      return 'Authentication failed';
    }

    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return 'Rate limit exceeded. Please try again later.';
    }
  }

  return 'An unexpected error occurred';
}

/**
 * Security wrapper for API routes
 */
export function withSecurity<T extends (args: ActionFunctionArgs | LoaderFunctionArgs) => Promise<Response>>(
  handler: T,
  options: {
    requireAuth?: boolean;
    rateLimit?: boolean;
    allowedMethods?: string[];
  } = {},
) {
  return async (args: ActionFunctionArgs | LoaderFunctionArgs): Promise<Response> => {
    const { request } = args;
    const endpoint = canonicalPathname(new URL(request.url).pathname);

    // Check allowed methods
    if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
      return new Response('Method not allowed', {
        status: 405,
        headers: createSecurityHeaders(),
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        assertSameOrigin(request);
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          Object.entries(createSecurityHeaders()).forEach(([key, value]) => headers.set(key, value));

          return new Response(error.body, { status: error.status, statusText: error.statusText, headers });
        }

        throw error;
      }
    }

    // Apply rate limiting
    if (options.rateLimit !== false) {
      const rateLimitResult = checkRateLimit(request, endpoint, args.context);

      if (rateLimitResult.unavailable) {
        return new Response('Rate limiting requires trusted client IP configuration', {
          status: 503,
          headers: createSecurityHeaders(),
        });
      }

      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: true,
            message: 'Too many requests. Wait a minute, then try again.',
            statusCode: 429,
            isRetryable: true,
            provider: 'hypeable',
          }),
          {
            status: 429,
            headers: {
              ...createSecurityHeaders(),
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000).toString(),
              'X-RateLimit-Reset': rateLimitResult.resetTime!.toString(),
            },
          },
        );
      }

      const clientIP = getTrustedClientIP(request, args.context);

      if (clientIP && EDGE_LIMITED_ENDPOINTS.has(endpoint)) {
        const edgeAllowed = await checkCloudflareRateLimit(args.context, endpoint, clientIP);

        if (!edgeAllowed) {
          return new Response(
            JSON.stringify({
              error: true,
              message: 'Too many requests. Wait a minute, then try again.',
              statusCode: 429,
              isRetryable: true,
              provider: 'hypeable',
            }),
            {
              status: 429,
              headers: {
                ...createSecurityHeaders(),
                'Content-Type': 'application/json',
                'Retry-After': '60',
              },
            },
          );
        }
      }
    }

    const attachSecurityHeaders = (headers: Headers) => {
      Object.entries(createSecurityHeaders()).forEach(([key, value]) => {
        headers.set(key, value);
      });

      if (isLlmRoute(endpoint)) {
        headers.set('Cache-Control', LLM_NO_STORE_HEADERS['Cache-Control']);
      }
    };

    try {
      // Execute the handler
      const response = await handler(args);

      const responseHeaders = new Headers(response.headers);
      attachSecurityHeaders(responseHeaders);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      /*
       * `throw new Response(...)` is React Router's control-flow idiom for
       * "stop here with this response". Several routes use it for 400s, and this
       * catch used to swallow every one of them into a 500 — the route's chosen
       * status was silently discarded.
       *
       * Checked FIRST, before the ApiError shape test. A Response also carries a
       * numeric `status` and an object `body`, so it matches that shape too, and
       * serializing its body would turn the response into a stream of `{}`.
       */
      if (error instanceof Response) {
        const responseHeaders = new Headers(error.headers);
        attachSecurityHeaders(responseHeaders);

        return new Response(error.body, {
          status: error.status,
          statusText: error.statusText,
          headers: responseHeaders,
        });
      }

      /*
       * A route that rejected the request on purpose carries its own status,
       * retryability and message. Collapsing those into 500 is how a malformed
       * request ends up presented to the user as a server fault, and it is what
       * made the client fall back to its generic "Request Failed" alert.
       *
       * Checked structurally rather than by importing ApiError, so this module
       * stays dependency-free for the routes that use it as a rate limiter.
       */
      if (isTypedApiError(error)) {
        const responseHeaders = new Headers({
          ...createSecurityHeaders(),
          'Content-Type': 'application/json',
        });
        attachSecurityHeaders(responseHeaders);

        return new Response(JSON.stringify(error.body), {
          status: error.status,
          headers: responseHeaders,
        });
      }

      console.error('Security-wrapped handler error:', redactUnknown(error));

      const errorMessage = sanitizeErrorMessage(error, process.env.NODE_ENV === 'development');

      return new Response(
        JSON.stringify({
          error: true,
          message: errorMessage,
        }),
        {
          status: 500,
          headers: {
            ...createSecurityHeaders(),
            ...(isLlmRoute(endpoint) ? LLM_NO_STORE_HEADERS : {}),
            'Content-Type': 'application/json',
          },
        },
      );
    }
  };
}

/**
 * Structural check for an ApiError.
 *
 * Deliberately avoids importing the class: security.ts is imported by routes
 * that have no business pulling in the model-facing error module, and this keeps
 * the check cheap and cycle-free.
 *
 * Note this tests the *shape*, not `name`. Subclasses set their own name
 * (`ValidationError`, `PayloadTooLargeError`, `RequestTimeoutError`), so a
 * `name === 'ApiError'` test would reject exactly the errors carrying the most
 * precise status — the ones it exists to preserve. `body` + numeric `status` is
 * what actually distinguishes them, since a plain Error has neither.
 */
function isTypedApiError(error: unknown): error is { status: number; body: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'body' in error &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number' &&
    typeof (error as { body?: unknown }).body === 'object' &&
    (error as { body?: unknown }).body !== null
  );
}
