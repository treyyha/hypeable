/**
 * Start / finish / disconnect the OpenRouter PKCE connect flow.
 *
 * The minted key is stored exactly like a pasted OpenRouter key
 * (`hypeable_api_keys`). Verifier and state never leave sessionStorage.
 */
import {
  OPENROUTER_AUTH_URL,
  OPENROUTER_CALLBACK_PATH,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_KEY_LABEL,
  OPENROUTER_OAUTH_FLAG_KEY,
  OPENROUTER_OPEN_PICKER_KEY,
  OPENROUTER_PROVIDER,
  OPENROUTER_TOAST_KEY,
} from './constants';
import { createPkcePair } from './pkce';
import { clearPkceSession, writePkceSession } from './session';
import { readStoredApiKeys, writeStoredApiKeys } from '~/lib/api/api-key-storage';
import { writePref } from '~/lib/api/prefs-storage';

export type AuthUrlInput = {
  origin: string;
  challenge: string;
  state: string;
};

export function openRouterCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${OPENROUTER_CALLBACK_PATH}`;
}

export function buildOpenRouterAuthUrl(input: AuthUrlInput): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set('callback_url', openRouterCallbackUrl(input.origin));
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', input.state);
  url.searchParams.set('key_label', OPENROUTER_KEY_LABEL);

  return url.toString();
}

export async function startOpenRouterConnect(win: Pick<Window, 'location' | 'sessionStorage'> = window): Promise<void> {
  const { verifier, challenge, state } = await createPkcePair();
  writePkceSession(win.sessionStorage, { verifier, state });
  win.location.assign(buildOpenRouterAuthUrl({ origin: win.location.origin, challenge, state }));
}

export function applyOpenRouterKey(key: string): void {
  writeStoredApiKeys({ ...readStoredApiKeys(), [OPENROUTER_PROVIDER]: key }, OPENROUTER_PROVIDER);
  persistOauthFlag(true);
  writePref('selectedProvider', OPENROUTER_PROVIDER);
  writePref('selectedModel', OPENROUTER_DEFAULT_MODEL);
}

export function disconnectOpenRouter(): void {
  const next = { ...readStoredApiKeys() };
  delete next[OPENROUTER_PROVIDER];
  writeStoredApiKeys(next, OPENROUTER_PROVIDER);
  persistOauthFlag(false);
}

export function isOpenRouterOAuthConnected(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const keys = readStoredApiKeys();

  if (!keys[OPENROUTER_PROVIDER]) {
    return false;
  }

  return (
    window.sessionStorage.getItem(OPENROUTER_OAUTH_FLAG_KEY) === '1' ||
    window.localStorage.getItem(OPENROUTER_OAUTH_FLAG_KEY) === '1'
  );
}

export function queueOpenRouterToast(kind: 'success' | 'error', message?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(OPENROUTER_TOAST_KEY, JSON.stringify({ kind, message: message ?? '' }));
}

export function takeOpenRouterToast(): { kind: 'success' | 'error'; message: string } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(OPENROUTER_TOAST_KEY);
  window.sessionStorage.removeItem(OPENROUTER_TOAST_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { kind?: unknown; message?: unknown };

    if (parsed.kind !== 'success' && parsed.kind !== 'error') {
      return null;
    }

    return { kind: parsed.kind, message: typeof parsed.message === 'string' ? parsed.message : '' };
  } catch {
    return null;
  }
}

export function finishPkceSession(storage: Pick<Storage, 'removeItem'> = window.sessionStorage): void {
  clearPkceSession(storage);
}

export function queueOpenModelPicker(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(OPENROUTER_OPEN_PICKER_KEY, '1');
}

export function takeOpenModelPicker(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const queued = window.sessionStorage.getItem(OPENROUTER_OPEN_PICKER_KEY) === '1';
  window.sessionStorage.removeItem(OPENROUTER_OPEN_PICKER_KEY);

  return queued;
}

function persistOauthFlag(connected: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (connected) {
    window.localStorage.setItem(OPENROUTER_OAUTH_FLAG_KEY, '1');
    return;
  }

  window.localStorage.removeItem(OPENROUTER_OAUTH_FLAG_KEY);
  window.sessionStorage.removeItem(OPENROUTER_OAUTH_FLAG_KEY);
}
