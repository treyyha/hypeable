/**
 * `data-href` on a quick-action button comes straight from model output, which
 * prompt injection (an imported README, a fetched page) can steer. Only open
 * http(s) links so a `javascript:` or `data:` href cannot run on our origin.
 */
export function safeQuickActionUrl(href: unknown, base: string): string | null {
  if (typeof href !== 'string') {
    return null;
  }

  try {
    const url = new URL(href, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
