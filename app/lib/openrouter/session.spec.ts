import { describe, expect, it } from 'vitest';
import { PKCE_STATE_KEY, PKCE_VERIFIER_KEY } from './constants';
import { assertCallbackState, clearPkceSession, readPkceSession, writePkceSession } from './session';

function memoryStorage(): Storage {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('OpenRouter PKCE session', () => {
  it('writes verifier and state to the given storage only', () => {
    const storage = memoryStorage();
    writePkceSession(storage, { verifier: 'v'.repeat(43), state: 's'.repeat(43) });

    expect(storage.getItem(PKCE_VERIFIER_KEY)).toHaveLength(43);
    expect(storage.getItem(PKCE_STATE_KEY)).toHaveLength(43);
    expect(readPkceSession(storage)?.state).toHaveLength(43);
  });

  it('rejects a missing or mismatched state', () => {
    expect(() => assertCallbackState('abc', 'xyz')).toThrow(/Paste a key instead/);
    expect(() => assertCallbackState('abc', null)).toThrow(/Paste a key instead/);
    expect(() => assertCallbackState(null, 'abc')).toThrow(/Paste a key instead/);
    expect(() => assertCallbackState('abc', 'abc')).not.toThrow();
  });

  it('clears verifier and state after use', () => {
    const storage = memoryStorage();
    writePkceSession(storage, { verifier: 'v'.repeat(43), state: 's'.repeat(43) });
    clearPkceSession(storage);
    expect(readPkceSession(storage)).toBeNull();
  });
});
