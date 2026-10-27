import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyOpenRouterKey,
  buildOpenRouterAuthUrl,
  disconnectOpenRouter,
  isOpenRouterOAuthConnected,
  openRouterCallbackUrl,
} from './connect';
import { OPENROUTER_DEFAULT_MODEL, OPENROUTER_OAUTH_FLAG_KEY, OPENROUTER_PROVIDER } from './constants';
import { API_KEYS_STORAGE_KEY, clearStoredApiKeys } from '~/lib/api/api-key-storage';
import { PREF_STORAGE_KEYS } from '~/lib/api/prefs-storage';

const FAKE_OR_KEY = 'sk-or-e2e-mock';

describe('OpenRouter connect helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    clearStoredApiKeys();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('builds an S256 auth URL with localhost callback, state, and key label', () => {
    const url = new URL(
      buildOpenRouterAuthUrl({
        origin: 'http://localhost:5173',
        challenge: 'challenge-value',
        state: 'csrf-state',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://openrouter.ai/auth');
    expect(url.searchParams.get('callback_url')).toBe('http://localhost:5173/auth/openrouter/callback');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('csrf-state');
    expect(url.searchParams.get('key_label')).toBe('Hypeable');
  });

  it('uses an https callback on a public origin', () => {
    expect(openRouterCallbackUrl('https://hypeable.dev')).toBe('https://hypeable.dev/auth/openrouter/callback');
  });

  it('stores the key where pasted OpenRouter keys live and selects a cheap default model', () => {
    applyOpenRouterKey(FAKE_OR_KEY);

    expect(JSON.parse(window.localStorage.getItem(API_KEYS_STORAGE_KEY) || '{}')).toEqual({
      [OPENROUTER_PROVIDER]: FAKE_OR_KEY,
    });
    expect(window.localStorage.getItem(OPENROUTER_OAUTH_FLAG_KEY)).toBe('1');
    expect(window.localStorage.getItem(PREF_STORAGE_KEYS.selectedProvider)).toBe(OPENROUTER_PROVIDER);
    expect(window.localStorage.getItem(PREF_STORAGE_KEYS.selectedModel)).toBe(OPENROUTER_DEFAULT_MODEL);
    expect(isOpenRouterOAuthConnected()).toBe(true);
  });

  it('disconnect removes the key and the connected flag', () => {
    applyOpenRouterKey(FAKE_OR_KEY);
    disconnectOpenRouter();

    expect(JSON.parse(window.localStorage.getItem(API_KEYS_STORAGE_KEY) || '{}')).toEqual({});
    expect(window.localStorage.getItem(OPENROUTER_OAUTH_FLAG_KEY)).toBeNull();
    expect(isOpenRouterOAuthConnected()).toBe(false);
  });
});
