import type { Page } from '@playwright/test';

/** Hosts that would contradict "no analytics / no phone-home / fonts self-hosted". */
export const FORBIDDEN_EXTERNAL_HOST_PARTS = [
  'google-analytics',
  'googletagmanager',
  'doubleclick.net',
  'facebook.net',
  'facebook.com',
  'posthog',
  'segment.io',
  'mixpanel',
  'sentry.io',
  'simpleicons.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'raw.githubusercontent.com',
  'cloudflareinsights',
  'googlesyndication',
];

export function collectRequestOrigins(page: Page) {
  const origins = new Set<string>();

  page.on('request', (request) => {
    try {
      origins.add(new URL(request.url()).origin);
    } catch {
      // blob: / data: / invalid
    }
  });

  return origins;
}

export function forbiddenOrigins(origins: Iterable<string>): string[] {
  return [...origins].filter((origin) => {
    let hostname = origin;

    try {
      hostname = new URL(origin).hostname;
    } catch {
      return false;
    }

    return FORBIDDEN_EXTERNAL_HOST_PARTS.some((part) => hostname.includes(part));
  });
}
