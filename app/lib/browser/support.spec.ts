import { describe, expect, it } from 'vitest';
import { browserSupportCopy, detectBrowserSupport } from './support';

describe('detectBrowserSupport', () => {
  it('accepts Chromium with isolation', () => {
    const status = detectBrowserSupport({
      userAgent: 'Mozilla/5.0 Chrome/131.0.0.0 Edg/131.0.0.0',
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
    });
    expect(status.supported).toBe(true);
    expect(status.chromium).toBe(true);
  });

  it('rejects Firefox and Safari even when isolated', () => {
    expect(
      detectBrowserSupport({
        userAgent: 'Mozilla/5.0 Firefox/131.0',
        crossOriginIsolated: true,
        hasSharedArrayBuffer: true,
      }).reason,
    ).toBe('not-chromium');
    expect(
      detectBrowserSupport({
        userAgent: 'Mozilla/5.0 Version/17.0 Safari/605.1.15',
        crossOriginIsolated: true,
        hasSharedArrayBuffer: true,
      }).reason,
    ).toBe('not-chromium');
  });

  it('rejects Chromium without isolation', () => {
    expect(
      detectBrowserSupport({
        userAgent: 'Mozilla/5.0 Chrome/131.0.0.0',
        crossOriginIsolated: false,
        hasSharedArrayBuffer: false,
      }).reason,
    ).toBe('not-isolated');
  });
});

describe('browserSupportCopy', () => {
  it('tells people to use Chrome or Edge', () => {
    const copy = browserSupportCopy({ isolated: true, chromium: false, supported: false, reason: 'not-chromium' });
    expect(copy.message).toMatch(/Chrome or Edge/);
  });
});
