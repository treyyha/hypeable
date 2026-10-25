import { describe, expect, it } from 'vitest';
import {
  asProviderSettings,
  encodeProviderSettingsHeader,
  getProviderSettingsFromRequest,
  HYPEABLE_PROVIDERS_HEADER,
} from './provider-settings';
import { HYPEABLE_KEY_HEADER } from './request-keys';

const BASE = 'http://127.0.0.1:8787/v1';

describe('asProviderSettings', () => {
  it('accepts the cookie shape and the localStorage store shape', () => {
    expect(
      asProviderSettings({
        OpenAILike: { enabled: true, baseUrl: BASE },
      }),
    ).toEqual({ OpenAILike: { enabled: true, baseUrl: BASE } });

    expect(
      asProviderSettings({
        OpenAILike: { settings: { enabled: true, baseUrl: BASE } },
      }),
    ).toEqual({ OpenAILike: { enabled: true, baseUrl: BASE } });
  });
});

describe('getProviderSettingsFromRequest', () => {
  it('prefers x-hypeable-providers over the providers cookie', () => {
    const headerValue = encodeProviderSettingsHeader({ OpenAILike: { enabled: true, baseUrl: BASE } });

    const request = new Request('https://example.com/api/models/OpenAILike', {
      headers: {
        [HYPEABLE_PROVIDERS_HEADER]: headerValue ?? '',
        Cookie: `providers=${encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl: 'http://stale.example/v1' } }))}`,
      },
    });

    expect(getProviderSettingsFromRequest(request)).toEqual({
      OpenAILike: { enabled: true, baseUrl: BASE },
    });
  });

  it('falls back to the providers cookie when the header is absent', () => {
    const request = new Request('https://example.com/api/chat', {
      headers: {
        Cookie: `providers=${encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl: BASE } }))}`,
      },
    });

    expect(getProviderSettingsFromRequest(request)).toEqual({
      OpenAILike: { enabled: true, baseUrl: BASE },
    });
  });

  it('reads a mixed-case providers header with decoded JSON', () => {
    const headers = new Headers();
    headers.set('X-Hypeable-Providers', JSON.stringify({ OpenAILike: { enabled: true, baseUrl: BASE } }));

    const request = new Request('https://example.com/api/models/OpenAILike', { headers });

    expect(getProviderSettingsFromRequest(request)).toEqual({
      OpenAILike: { enabled: true, baseUrl: BASE },
    });
  });

  it('does not treat x-hypeable-key as provider settings', () => {
    const request = new Request('https://example.com/api/models/OpenAILike', {
      headers: {
        [HYPEABLE_KEY_HEADER]: encodeURIComponent(JSON.stringify({ OpenAILike: 'sk-testkeytestkeytestkey12' })),
      },
    });

    expect(getProviderSettingsFromRequest(request)).toEqual({});
  });
});
