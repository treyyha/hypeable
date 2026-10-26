/**
 * WebContainer browser support, from https://webcontainers.io/guides/browser-support
 * (verified October 2026): Chromium (Chrome, Edge, Brave, …) is full support.
 * Firefox is alpha, Safari 16.4+ is beta. The isolation mode needed to embed
 * arbitrary preview resources is Chromium-only.
 */

export type BrowserSupportStatus = {
  isolated: boolean;
  chromium: boolean;
  supported: boolean;
  reason: 'ok' | 'not-isolated' | 'not-chromium';
};

export function detectBrowserSupport(input: {
  userAgent: string;
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
}): BrowserSupportStatus {
  const ua = input.userAgent;
  const isFirefox = /Firefox\//i.test(ua);
  const isSafari = /Safari\//i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua);
  const chromium = !isFirefox && !isSafari;
  const isolated = input.crossOriginIsolated && input.hasSharedArrayBuffer;

  if (!chromium) {
    return { isolated, chromium, supported: false, reason: 'not-chromium' };
  }

  if (!isolated) {
    return { isolated, chromium, supported: false, reason: 'not-isolated' };
  }

  return { isolated, chromium, supported: true, reason: 'ok' };
}

export function browserSupportCopy(status: BrowserSupportStatus): { title: string; message: string } {
  if (status.reason === 'not-chromium') {
    return {
      title: 'Use Chrome or Edge for the in-browser preview',
      message:
        'WebContainers fully support Chrome and other Chromium browsers. Firefox is alpha and Safari is beta, and their preview iframe is limited. Open Hypeable in Chrome or Edge to build.',
    };
  }

  if (status.reason === 'not-isolated') {
    return {
      title: 'This browser blocked the in-browser runtime',
      message:
        'Hypeable needs cross-origin isolation (SharedArrayBuffer) for WebContainers. Use Chrome or Edge, and turn off strict third-party cookie blocking for this site.',
    };
  }

  return { title: '', message: '' };
}
