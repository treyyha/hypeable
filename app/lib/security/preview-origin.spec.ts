import { describe, expect, it } from 'vitest';
import { isTrustedPreviewOrigin } from './preview-origin';

describe('isTrustedPreviewOrigin', () => {
  const page = 'https://hypeable.dev';

  it('allows the WebContainer preview origin and the wrapper page', () => {
    expect(isTrustedPreviewOrigin('https://abc123.local-credentialless.webcontainer-api.io', page)).toBe(true);
    expect(isTrustedPreviewOrigin('https://abc123.webcontainer-api.io', page)).toBe(true);
    expect(isTrustedPreviewOrigin(page, page)).toBe(true);
  });

  it('rejects other origins, including null and lookalikes', () => {
    expect(isTrustedPreviewOrigin('https://evil.example', page)).toBe(false);
    expect(isTrustedPreviewOrigin('null', page)).toBe(false);
    expect(isTrustedPreviewOrigin('', page)).toBe(false);
    expect(isTrustedPreviewOrigin('https://webcontainer-api.io.evil.com', page)).toBe(false);
    expect(isTrustedPreviewOrigin('https://not-webcontainer-api.io', page)).toBe(false);
    expect(isTrustedPreviewOrigin('https://abc.local-credentialless.webcontainer-api.io.evil.com', page)).toBe(false);
  });
});
