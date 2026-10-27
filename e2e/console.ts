import { expect, type Page } from '@playwright/test';

/**
 * First-load console must stay clean. Fail on console error/warning and on
 * failed or 4xx/5xx requests, except the documented allow-list below.
 *
 * Allowed:
 * - React DevTools install hint (info in some browsers, warning in others)
 * - Vite HMR `[vite]` lines in local `pnpm e2e` (not production)
 * - Framer Motion reduced-motion notice when the OS asks for it
 * - `favicon.ico` 404 — we ship `/favicon.svg`
 * - Aborted requests from in-page navigations (`net::ERR_ABORTED`)
 * - CSP-Report-Only `frame-src` hits on `https://stackblitz.com/` after a
 *   mocked build: WebContainer boots that frame; the enforcing CSP still
 *   allows `https:` frames. Hosted first load never hits this.
 */
const ALLOWED_CONSOLE = [
  /Download the React DevTools/i,
  /\[vite\]/,
  /\[Motion\].*Reduced Motion/i,
  /Framing 'https:\/\/stackblitz\.com\/' violates the following report-only/i,
];

const ALLOWED_REQUEST = [
  /\/favicon\.ico(?:\?|$)/,
  /net::ERR_ABORTED|NS_BINDING_ABORTED/i,
];

export function attachConsoleGuard(page: Page) {
  const hits: string[] = [];

  page.on('console', (message) => {
    const type = message.type();

    if (type !== 'error' && type !== 'warning') {
      return;
    }

    const text = message.text();

    if (ALLOWED_CONSOLE.some((pattern) => pattern.test(text))) {
      return;
    }

    hits.push(`console.${type}: ${text}`);
  });

  page.on('pageerror', (error) => {
    hits.push(`pageerror: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    const url = request.url();

    if (ALLOWED_REQUEST.some((pattern) => pattern.test(url) || pattern.test(failure))) {
      return;
    }

    hits.push(`requestfailed: ${request.method()} ${url} ${failure}`);
  });

  page.on('response', (response) => {
    const status = response.status();

    if (status < 400) {
      return;
    }

    const url = response.url();

    if (ALLOWED_REQUEST.some((pattern) => pattern.test(url))) {
      return;
    }

    hits.push(`http ${status}: ${url}`);
  });

  return {
    assertClean() {
      expect(hits, hits.join('\n')).toEqual([]);
    },
  };
}
