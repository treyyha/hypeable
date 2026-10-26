/**
 * Browser isolation + report-only CSP for the HTML document.
 * Keep `public/_headers` in sync with these values.
 *
 * COOP/COEP are required for WebContainer SharedArrayBuffer. CSP is report-only
 * first so a missing WebContainer origin does not brick the preview iframe.
 */
export const COEP_HEADER = 'credentialless';
export const COOP_HEADER = 'same-origin';

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
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy-Report-Only': CSP_REPORT_ONLY,
};
