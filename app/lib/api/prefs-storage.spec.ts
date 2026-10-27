import Cookies from 'js-cookie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_PREF_COOKIES,
  PREF_STORAGE_KEYS,
  migrateLegacyPrefCookies,
  readPref,
  removePref,
  writePref,
} from './prefs-storage';
import { PROVIDER_SETTINGS_STORAGE_KEY } from './provider-settings';
import { PROMPT_COOKIE_KEY } from '~/utils/constants';

describe('prefs-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();

    for (const name of LEGACY_PREF_COOKIES) {
      Cookies.remove(name);
      Cookies.remove(name, { path: '/' });
    }
  });

  afterEach(() => {
    window.localStorage.clear();

    for (const name of LEGACY_PREF_COOKIES) {
      Cookies.remove(name);
      Cookies.remove(name, { path: '/' });
    }
  });

  it('writes prefs to localStorage, not cookies', () => {
    writePref('selectedModel', 'mock-model');
    writePref('cachedPrompt', 'draft text');

    expect(window.localStorage.getItem(PREF_STORAGE_KEYS.selectedModel)).toBe('mock-model');
    expect(window.localStorage.getItem(PREF_STORAGE_KEYS.cachedPrompt)).toBe('draft text');
    expect(Cookies.get('selectedModel')).toBeUndefined();
    expect(Cookies.get(PROMPT_COOKIE_KEY)).toBeUndefined();
    expect(document.cookie).not.toContain('draft text');
  });

  it('migrates leftover cookies into storage and deletes them', () => {
    Cookies.set('selectedModel', 'cookie-model');
    Cookies.set('selectedProvider', 'OpenAILike');
    Cookies.set(PROMPT_COOKIE_KEY, 'secret draft prompt');
    Cookies.set('agentMode', 'true');
    Cookies.set('isDebugEnabled', 'true');
    Cookies.set('eventLogs', '{"1":{"message":"user said hello"}}');
    Cookies.set('tabConfiguration', '{"userTabs":[]}');
    Cookies.set('providers', JSON.stringify({ OpenAILike: { enabled: true, baseUrl: 'http://127.0.0.1:8787/v1' } }));

    migrateLegacyPrefCookies();

    expect(readPref('selectedModel')).toBe('cookie-model');
    expect(readPref('selectedProvider')).toBe('OpenAILike');
    expect(readPref('cachedPrompt')).toBe('secret draft prompt');
    expect(readPref('agentMode')).toBe('true');
    expect(readPref('debug')).toBe('true');
    expect(readPref('eventLogs')).toContain('user said hello');
    expect(JSON.parse(window.localStorage.getItem(PROVIDER_SETTINGS_STORAGE_KEY) || '{}')).toEqual({
      OpenAILike: { settings: { enabled: true, baseUrl: 'http://127.0.0.1:8787/v1' } },
    });

    for (const name of LEGACY_PREF_COOKIES) {
      expect(Cookies.get(name), name).toBeUndefined();
    }
  });

  it('does not overwrite existing storage with an older cookie', () => {
    writePref('selectedModel', 'from-storage');
    Cookies.set('selectedModel', 'from-cookie');

    migrateLegacyPrefCookies();

    expect(readPref('selectedModel')).toBe('from-storage');
    expect(Cookies.get('selectedModel')).toBeUndefined();
  });

  it('removePref clears storage and leftover cookies', () => {
    writePref('cachedPrompt', 'draft');
    Cookies.set(PROMPT_COOKIE_KEY, 'stale');
    removePref('cachedPrompt');

    expect(readPref('cachedPrompt')).toBeUndefined();
    expect(Cookies.get(PROMPT_COOKIE_KEY)).toBeUndefined();
  });
});
