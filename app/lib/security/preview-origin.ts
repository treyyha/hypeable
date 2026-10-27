/**
 * postMessage from the WebContainer preview iframe. The generated app runs on
 * `*.webcontainer-api.io`, not on hypeable.dev, so it cannot read our
 * localStorage. Handlers must still check event.source and event.origin so a
 * random tab cannot spoof inspector events.
 */

const WEBCONTAINER_PREVIEW = /^https:\/\/[a-z0-9-]+\.(?:local-credentialless\.)?webcontainer-api\.io$/i;

export function isTrustedPreviewOrigin(origin: string, pageOrigin?: string): boolean {
  if (!origin || origin === 'null') {
    return false;
  }

  if (pageOrigin && origin === pageOrigin) {
    return true;
  }

  return WEBCONTAINER_PREVIEW.test(origin);
}

export function isTrustedPreviewMessage(event: MessageEvent, iframe: HTMLIFrameElement | null): boolean {
  if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
    return false;
  }

  const pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return isTrustedPreviewOrigin(event.origin, pageOrigin);
}

export function previewPostMessageTarget(iframe: HTMLIFrameElement | null): string {
  const src = iframe?.src;

  if (!src) {
    return 'null';
  }

  try {
    const origin = new URL(src, typeof window !== 'undefined' ? window.location.href : 'https://hypeable.dev').origin;

    if (isTrustedPreviewOrigin(origin, typeof window !== 'undefined' ? window.location.origin : undefined)) {
      return origin;
    }
  } catch {
    // iframe src not yet a URL
  }

  return 'null';
}
