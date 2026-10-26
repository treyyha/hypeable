/**
 * PKCE verifier + anti-CSRF state live in sessionStorage only.
 * They must not land in localStorage, cookies, or the URL.
 */
import { PKCE_STATE_KEY, PKCE_VERIFIER_KEY } from './constants';

export type PkceSession = {
  verifier: string;
  state: string;
};

type ReadableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function writePkceSession(storage: ReadableStorage, session: PkceSession): void {
  storage.setItem(PKCE_VERIFIER_KEY, session.verifier);
  storage.setItem(PKCE_STATE_KEY, session.state);
}

export function readPkceSession(storage: ReadableStorage): PkceSession | null {
  const verifier = storage.getItem(PKCE_VERIFIER_KEY);
  const state = storage.getItem(PKCE_STATE_KEY);

  if (!verifier || !state) {
    return null;
  }

  return { verifier, state };
}

export function clearPkceSession(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(PKCE_VERIFIER_KEY);
  storage.removeItem(PKCE_STATE_KEY);
}

/**
 * Reject the callback when `state` is missing or does not match what we stored.
 * OpenRouter returns `state` unchanged on authorize; it is omitted on deny.
 */
export function assertCallbackState(expected: string | null | undefined, received: string | null | undefined): void {
  if (!expected || !received || expected !== received) {
    throw new Error('Could not confirm this login came from Hypeable. Paste a key instead.');
  }
}
