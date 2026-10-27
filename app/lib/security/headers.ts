/**
 * Document isolation headers vs the smaller API set.
 *
 * HTML (`app/entry.server.tsx`) and static assets (`public/_headers`) get
 * COOP/COEP (WebContainer SharedArrayBuffer), Permissions-Policy, an
 * enforcing CSP, and a stricter CSP-Report-Only for monitoring. JSON/SSE
 * `/api/*` responses get nosniff, Referrer-Policy, and Cache-Control: no-store
 * only — applied in `workers/app.ts` so every Worker API response is covered
 * without buffering the body.
 */
export const COEP_HEADER = 'credentialless';
export const COOP_HEADER = 'same-origin';
export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

const LOCAL_CONNECT = 'http://127.0.0.1:* http://localhost:* http://[::1]:*';
const WEBCONTAINER_FRAME = 'https://*.webcontainer-api.io https://*.local-credentialless.webcontainer-api.io';
const WEBCONTAINER_CONNECT = `${WEBCONTAINER_FRAME} wss://*.webcontainer-api.io wss://*.local-credentialless.webcontainer-api.io`;

/*
 * Enforcing CSP. Keep `https:` in connect/frame because the user picks a
 * provider at runtime (OpenAI, Groq, a new first-party host) and WebContainer
 * preview frames are generated per session. Tightening those to a static host
 * list breaks Connect / preview / publish.
 *
 * unsafe-inline / unsafe-eval (justified, not removable without a rewrite):
 * - script-src 'unsafe-inline': root theme + OpenRouter callback-strip scripts
 * - script-src 'unsafe-eval' + 'wasm-unsafe-eval': WebContainer compiles guest JS
 * - style-src 'unsafe-inline': UnoCSS/runtime component styles
 */
export const CSP_ENFORCING = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' blob: data: https: wss: ${LOCAL_CONNECT}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `frame-src 'self' blob: https: ${LOCAL_CONNECT}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/*
 * Stricter report-only: no blanket `https:` on connect/frame. Browser console
 * (and Playwright) record violations when a new provider or preview host appears
 * so we can extend the list without breaking a flow first.
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [
    "connect-src 'self' blob: data:",
    WEBCONTAINER_CONNECT,
    'https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com',
    'https://openrouter.ai https://api.groq.com https://api.deepseek.com https://api.mistral.ai',
    'https://api.x.ai https://api.together.xyz https://api.perplexity.ai https://api.cohere.ai https://api.cohere.com',
    'https://api-inference.huggingface.co https://router.huggingface.co https://huggingface.co',
    'https://api.fireworks.ai https://api.cerebras.ai https://api.moonshot.ai https://api.moonshot.cn',
    'https://api.hyperbolic.xyz https://api.z.ai https://open.bigmodel.cn',
    'https://models.github.ai https://models.inference.ai.azure.com',
    'https://api.github.com https://github.com https://gitlab.com https://api.vercel.com https://api.netlify.com https://api.supabase.com',
    LOCAL_CONNECT,
  ].join(' '),
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `frame-src 'self' blob: ${WEBCONTAINER_FRAME} ${LOCAL_CONNECT}`,
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

  /*
   * no-transform stops Cloudflare from injecting Web Analytics
   * (static.cloudflareinsights.com/beacon.min.js) into HTML. Do not put
   * this on public/_headers /* — that would uncache JS/CSS/fonts.
   */
  'Cache-Control': 'no-store, no-transform',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': CSP_ENFORCING,
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
  'Content-Security-Policy',
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
