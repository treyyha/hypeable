import Cookies from 'js-cookie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  API_KEYS_FORGET_KEY,
  API_KEYS_STORAGE_KEY,
  LEGACY_API_KEYS_COOKIE,
  clearStoredApiKeys,
  getForgetKeysOnTabClose,
  getLlmRequestHeaders,
  HYPEABLE_KEY_HEADER,
  migrateApiKeysFromCookie,
  readStoredApiKeys,
  setForgetKeysOnTabClose,
  writeStoredApiKeys,
} from './api-key-storage';
import { HYPEABLE_PROVIDERS_HEADER, PROVIDER_SETTINGS_STORAGE_KEY } from './provider-settings';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

describe('api-key-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Cookies.remove(LEGACY_API_KEYS_COOKIE);
    Cookies.remove(LEGACY_API_KEYS_COOKIE, { path: '/' });
    document.cookie = `${LEGACY_API_KEYS_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  afterEach(() => {
    clearStoredApiKeys();
    Cookies.remove(LEGACY_API_KEYS_COOKIE);
    Cookies.remove(LEGACY_API_KEYS_COOKIE, { path: '/' });
  });

  it('stores keys in localStorage by default, not a cookie', () => {
    writeStoredApiKeys({ OpenAI: FAKE_KEY });

    expect(readStoredApiKeys()).toEqual({ OpenAI: FAKE_KEY });
    expect(window.localStorage.getItem(API_KEYS_STORAGE_KEY)).toContain('OpenAI');
    expect(document.cookie.includes(`${LEGACY_API_KEYS_COOKIE}=`)).toBe(false);
  });

  it('moves keys to sessionStorage when forget-on-close is enabled', () => {
    writeStoredApiKeys({ OpenAI: FAKE_KEY });
    setForgetKeysOnTabClose(true);

    expect(getForgetKeysOnTabClose()).toBe(true);
    expect(window.sessionStorage.getItem(API_KEYS_FORGET_KEY)).toBe('1');
    expect(window.sessionStorage.getItem(API_KEYS_STORAGE_KEY)).toContain('OpenAI');
    expect(window.localStorage.getItem(API_KEYS_STORAGE_KEY)).toBeNull();
    expect(readStoredApiKeys()).toEqual({ OpenAI: FAKE_KEY });
  });

  it('migrates the legacy apiKeys cookie into storage and deletes it', () => {
    Cookies.set(LEGACY_API_KEYS_COOKIE, JSON.stringify({ OpenAI: FAKE_KEY }));
    expect(Cookies.get(LEGACY_API_KEYS_COOKIE)).toBeTruthy();

    const migrated = migrateApiKeysFromCookie();

    expect(migrated).toEqual({ OpenAI: FAKE_KEY });
    expect(readStoredApiKeys()).toEqual({ OpenAI: FAKE_KEY });
    expect(Cookies.get(LEGACY_API_KEYS_COOKIE)).toBeUndefined();
  });

  it('puts stored keys in x-hypeable-key for /api/chat', () => {
    writeStoredApiKeys({ OpenAI: FAKE_KEY });

    const headers = getLlmRequestHeaders();

    expect(headers[HYPEABLE_KEY_HEADER]).toBe(encodeURIComponent(JSON.stringify({ OpenAI: FAKE_KEY })));
    expect(JSON.stringify(headers)).not.toContain('apiKeys');
  });

  it('does not dispatch bolt:api-keys-updated when the stored map is unchanged', () => {
    writeStoredApiKeys({ OpenAI: FAKE_KEY });

    let count = 0;

    const onUpdate = () => {
      count += 1;
    };

    window.addEventListener('bolt:api-keys-updated', onUpdate);

    writeStoredApiKeys({ OpenAI: FAKE_KEY }, 'OpenAI');

    window.removeEventListener('bolt:api-keys-updated', onUpdate);

    expect(count).toBe(0);
  });

  it('puts OpenAILike base URL in x-hypeable-providers from localStorage', () => {
    writeStoredApiKeys({ OpenAILike: FAKE_KEY });
    window.localStorage.setItem(
      PROVIDER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        OpenAILike: { settings: { enabled: true, baseUrl: 'http://127.0.0.1:8787/v1' } },
      }),
    );

    const headers = getLlmRequestHeaders();

    expect(headers[HYPEABLE_PROVIDERS_HEADER]).toBe(
      encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl: 'http://127.0.0.1:8787/v1' } })),
    );
  });
});
