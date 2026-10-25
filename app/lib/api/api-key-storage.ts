/**
 * Browser storage for BYO LLM keys.
 *
 * Keys live in localStorage by default, or sessionStorage when the user
 * chooses "forget keys when I close the tab". They are never written to a
 * cookie — cookies attach to every same-origin request.
 */
import Cookies from 'js-cookie';
import { API_KEYS_UPDATED_EVENT, type ApiKeysUpdatedDetail } from '~/lib/api/apiKeys';

export const API_KEYS_STORAGE_KEY = 'hypeable_api_keys';
export const API_KEYS_FORGET_KEY = 'hypeable_api_keys_forget';
export const LEGACY_API_KEYS_COOKIE = 'apiKeys';
export const HYPEABLE_KEY_HEADER = 'x-hypeable-key';

const EMPTY_KEYS: Record<string, string> = {};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parseKeyMap(raw: string | null | undefined): Record<string, string> {
  if (!raw) {
    return { ...EMPTY_KEYS };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...EMPTY_KEYS };
    }

    const out: Record<string, string> = {};

    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length > 0) {
        out[name] = value;
      }
    }

    return out;
  } catch {
    return { ...EMPTY_KEYS };
  }
}

export function getForgetKeysOnTabClose(): boolean {
  if (!canUseStorage()) {
    return false;
  }

  return window.sessionStorage.getItem(API_KEYS_FORGET_KEY) === '1';
}

function activeStore(): Storage {
  return getForgetKeysOnTabClose() ? window.sessionStorage : window.localStorage;
}

function inactiveStore(): Storage {
  return getForgetKeysOnTabClose() ? window.localStorage : window.sessionStorage;
}

export function readStoredApiKeys(): Record<string, string> {
  if (!canUseStorage()) {
    return { ...EMPTY_KEYS };
  }

  migrateApiKeysFromCookie();

  return parseKeyMap(activeStore().getItem(API_KEYS_STORAGE_KEY));
}

export function writeStoredApiKeys(keys: Record<string, string>, providerName?: string): void {
  if (!canUseStorage()) {
    return;
  }

  const next: Record<string, string> = {};

  for (const [name, value] of Object.entries(keys)) {
    if (typeof value === 'string' && value.length > 0) {
      next[name] = value;
    }
  }

  activeStore().setItem(API_KEYS_STORAGE_KEY, JSON.stringify(next));
  inactiveStore().removeItem(API_KEYS_STORAGE_KEY);
  deleteLegacyApiKeysCookie();

  if (providerName) {
    window.dispatchEvent(
      new CustomEvent<ApiKeysUpdatedDetail>(API_KEYS_UPDATED_EVENT, { detail: { apiKeys: next, providerName } }),
    );
  }
}

export function clearStoredApiKeys(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(API_KEYS_STORAGE_KEY);
  window.sessionStorage.removeItem(API_KEYS_STORAGE_KEY);
  deleteLegacyApiKeysCookie();
}

export function setForgetKeysOnTabClose(forget: boolean): void {
  if (!canUseStorage()) {
    return;
  }

  const keys = readStoredApiKeys();

  if (forget) {
    window.sessionStorage.setItem(API_KEYS_FORGET_KEY, '1');
  } else {
    window.sessionStorage.removeItem(API_KEYS_FORGET_KEY);
  }

  writeStoredApiKeys(keys);
}

function deleteLegacyApiKeysCookie(): void {
  Cookies.remove(LEGACY_API_KEYS_COOKIE);
  Cookies.remove(LEGACY_API_KEYS_COOKIE, { path: '/' });
}

/**
 * One-shot move of the old `apiKeys` cookie into web storage, then delete it.
 */
export function migrateApiKeysFromCookie(): Record<string, string> {
  if (!canUseStorage()) {
    return { ...EMPTY_KEYS };
  }

  const stored = parseKeyMap(activeStore().getItem(API_KEYS_STORAGE_KEY));
  const rawCookie = Cookies.get(LEGACY_API_KEYS_COOKIE);

  if (!rawCookie) {
    return stored;
  }

  const fromCookie = parseKeyMap(rawCookie);
  const merged = { ...fromCookie, ...stored };

  activeStore().setItem(API_KEYS_STORAGE_KEY, JSON.stringify(merged));
  inactiveStore().removeItem(API_KEYS_STORAGE_KEY);
  deleteLegacyApiKeysCookie();

  return merged;
}

export function encodeApiKeysHeader(keys: Record<string, string>): string | undefined {
  const usable: Record<string, string> = {};

  for (const [name, value] of Object.entries(keys)) {
    if (value) {
      usable[name] = value;
    }
  }

  if (Object.keys(usable).length === 0) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(usable));
}

export function getLlmRequestHeaders(): Record<string, string> {
  const value = encodeApiKeysHeader(readStoredApiKeys());

  return value ? { [HYPEABLE_KEY_HEADER]: value } : {};
}

export function llmFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  keys: Record<string, string> = readStoredApiKeys(),
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const keyHeader = encodeApiKeysHeader(keys);

  if (keyHeader) {
    headers.set(HYPEABLE_KEY_HEADER, keyHeader);
  }

  return fetch(input, { ...init, headers });
}
