/**
 * Browser prefs that used to ride in cookies. Cookies attach to every
 * same-origin request (HTML, static assets, API), so drafts, logs, and
 * picker state live in localStorage. Leftover cookies are copied once
 * then deleted.
 */
import Cookies from 'js-cookie';
import { safeJsonParse } from '~/lib/api/cookies';
import { asProviderSettings, PROVIDER_SETTINGS_STORAGE_KEY } from '~/lib/api/provider-settings';
import { PROMPT_COOKIE_KEY } from '~/utils/constants';

export const PREF_STORAGE_KEYS = {
  selectedModel: 'hypeable:pref:selectedModel',
  selectedProvider: 'hypeable:pref:selectedProvider',
  agentMode: 'hypeable:pref:agentMode',
  cachedPrompt: 'hypeable:pref:cachedPrompt',
  debug: 'hypeable:pref:debug',
  eventLogs: 'hypeable:eventLogs',
} as const;

export type PrefName = keyof typeof PREF_STORAGE_KEYS;

/**
 * Cookie names this app used to set. Listed so migration and the e2e
 * cookie-diet test share one source of truth.
 */
export const LEGACY_PREF_COOKIES = [
  'selectedModel',
  'selectedProvider',
  'providers',
  PROMPT_COOKIE_KEY,
  'agentMode',
  'isDebugEnabled',
  'eventLogs',
  'tabConfiguration',
] as const;

const COOKIE_TO_PREF: Partial<Record<(typeof LEGACY_PREF_COOKIES)[number], PrefName>> = {
  selectedModel: 'selectedModel',
  selectedProvider: 'selectedProvider',
  [PROMPT_COOKIE_KEY]: 'cachedPrompt',
  agentMode: 'agentMode',
  isDebugEnabled: 'debug',
  eventLogs: 'eventLogs',
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function deleteAppCookie(name: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  Cookies.remove(name);
  Cookies.remove(name, { path: '/' });
}

export function readPref(name: PrefName): string | undefined {
  if (!canUseStorage()) {
    return undefined;
  }

  migrateLegacyPrefCookies();

  const value = window.localStorage.getItem(PREF_STORAGE_KEYS[name]);

  return value === null ? undefined : value;
}

export function writePref(name: PrefName, value: string): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PREF_STORAGE_KEYS[name], value);

  const cookieName = Object.entries(COOKIE_TO_PREF).find(([, pref]) => pref === name)?.[0];

  if (cookieName) {
    deleteAppCookie(cookieName);
  }
}

export function removePref(name: PrefName): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PREF_STORAGE_KEYS[name]);

  const cookieName = Object.entries(COOKIE_TO_PREF).find(([, pref]) => pref === name)?.[0];

  if (cookieName) {
    deleteAppCookie(cookieName);
  }
}

function migrateStringCookie(cookieName: (typeof LEGACY_PREF_COOKIES)[number], pref: PrefName): void {
  const raw = Cookies.get(cookieName);

  if (raw && window.localStorage.getItem(PREF_STORAGE_KEYS[pref]) === null) {
    window.localStorage.setItem(PREF_STORAGE_KEYS[pref], raw);
  }

  if (raw !== undefined) {
    deleteAppCookie(cookieName);
  }
}

/**
 * Copy leftover preference cookies into localStorage, then delete them so
 * they stop riding on later requests. Storage wins when both exist.
 */
export function migrateLegacyPrefCookies(): void {
  if (!canUseStorage()) {
    return;
  }

  migrateStringCookie('selectedModel', 'selectedModel');
  migrateStringCookie('selectedProvider', 'selectedProvider');
  migrateStringCookie(PROMPT_COOKIE_KEY, 'cachedPrompt');
  migrateStringCookie('agentMode', 'agentMode');
  migrateStringCookie('isDebugEnabled', 'debug');
  migrateStringCookie('eventLogs', 'eventLogs');
  migrateProvidersCookie();
  deleteAppCookie('tabConfiguration');
}

function migrateProvidersCookie(): void {
  const raw = Cookies.get('providers');

  if (!raw) {
    deleteAppCookie('providers');
    return;
  }

  if (window.localStorage.getItem(PROVIDER_SETTINGS_STORAGE_KEY) === null) {
    const settings = asProviderSettings(safeJsonParse<unknown>(raw, {}));
    const stored: Record<string, { settings: (typeof settings)[string] }> = {};

    for (const [name, value] of Object.entries(settings)) {
      stored[name] = { settings: value };
    }

    if (Object.keys(stored).length > 0) {
      window.localStorage.setItem(PROVIDER_SETTINGS_STORAGE_KEY, JSON.stringify(stored));
    }
  }

  deleteAppCookie('providers');
}
