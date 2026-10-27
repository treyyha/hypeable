/**
 * Document isolation headers vs the smaller API set.
 *
 * HTML (`app/entry.server.tsx`) and static assets (`public/_headers`) get
 * COOP/COEP (WebContainer SharedArrayBuffer), Permissions-Policy, and
 * CSP-Report-Only. JSON/SSE `/api/*` responses get nosniff, Referrer-Policy,
 * and Cache-Control: no-store only — applied in `workers/app.ts` so every
 * Worker API response is covered without buffering the body.
 */
export const COEP_HEADER = 'credentialless';
export const COOP_HEADER = 'same-origin';
export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

/*
 * Why each directive is this loose:
 * - script/worker wasm-unsafe-eval + blob: — WebContainer compiles and runs guest JS
 * - connect/frame https: and localhost — preview iframes and the user's model provider
 * - wss: — WebContainer / preview live reload
 * First-party LLM hosts are already allowlisted server-side; the browser still
 * talks to whatever provider the user picked, plus GitHub/GitLab/Vercel/Netlify.
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https: wss: http://127.0.0.1:* http://localhost:* http://[::1]:*",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' blob: https: http://localhost:* http://127.0.0.1:* http://[::1]:*",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const DOCUMENT_SECURITY_HEADERS: Record<string, string> = {
  'Cross-Origin-Embedder-Policy': COEP_HEADER,
  'Cross-Origin-Opener-Policy': COOP_HEADER,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': REFERRER_POLICY,
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy-Report-Only': CSP_REPORT_ONLY,
};

export const API_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': REFERRER_POLICY,
  'Cache-Control': 'no-store',
};

/** Document-only names that must not be copied onto JSON/SSE. */
export const DOCUMENT_ONLY_HEADER_NAMES = [
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Opener-Policy',
  'Permissions-Policy',
  'Content-Security-Policy-Report-Only',
] as const;

const REFERRER_POLICY_RANK: Record<string, number> = {
  'unsafe-url': 0,
  'no-referrer-when-downgrade': 1,
  'origin-when-cross-origin': 2,
  origin: 3,
  'strict-origin-when-cross-origin': 4,
  'strict-origin': 5,
  'same-origin': 6,
  'no-referrer': 7,
};

function cacheControlHasNoStore(value: string): boolean {
  return value.split(',').some((part) => part.trim().toLowerCase() === 'no-store');
}

function referrerPolicyRank(value: string): number {
  return REFERRER_POLICY_RANK[value.trim().toLowerCase()] ?? -1;
}

export function isApiRequest(request: Request): boolean {
  try {
    const { pathname } = new URL(request.url);
    return pathname === '/api' || pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/**
 * Copy status/headers and pass the original body through so SSE is not buffered.
 * Missing API headers are filled in; a stricter Cache-Control or Referrer-Policy
 * already on the response is left alone.
 */
export function applyApiSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  const nosniff = headers.get('X-Content-Type-Options');

  if (!nosniff || nosniff.trim().toLowerCase() !== 'nosniff') {
    headers.set('X-Content-Type-Options', API_SECURITY_HEADERS['X-Content-Type-Options']);
  }

  const referrer = headers.get('Referrer-Policy');

  if (!referrer || referrerPolicyRank(referrer) < referrerPolicyRank(REFERRER_POLICY)) {
    headers.set('Referrer-Policy', REFERRER_POLICY);
  }

  const cacheControl = headers.get('Cache-Control');

  if (!cacheControl || !cacheControlHasNoStore(cacheControl)) {
    headers.set('Cache-Control', API_SECURITY_HEADERS['Cache-Control']);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
