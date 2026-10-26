import { afterEach, describe, expect, it } from 'vitest';
import {
  captureAndStripCallbackUrl,
  captureCallbackFromWindow,
  resetCapturedCallback,
  takeStashedCallback,
} from './callback';
import { CALLBACK_STASH_KEY } from './constants';

afterEach(() => {
  resetCapturedCallback();
});

function fakeWindow(href: string, stash?: { code: string | null; state: string | null; error: string | null }) {
  let current = href;

  const history = {
    replaceState(_data: unknown, _unused: string, url?: string | null) {
      if (typeof url === 'string') {
        current = new URL(url, current).href;
      }
    },
  };
  const location = {
    get href() {
      return current;
    },
    get pathname() {
      return new URL(current).pathname;
    },
    get search() {
      return new URL(current).search;
    },
  };

  const win = {
    location,
    history,
    ...(stash ? { [CALLBACK_STASH_KEY]: stash } : {}),
  };

  return { win, getHref: () => current };
}

describe('OpenRouter callback capture', () => {
  it('strips code, state, and error from the URL', () => {
    const href = 'http://localhost:5173/auth/openrouter/callback?code=auth_code_abc&state=csrf123&error=access_denied';

    let current = href;

    const location = {
      get href() {
        return current;
      },
      pathname: '/auth/openrouter/callback',
      search: '?code=auth_code_abc&state=csrf123&error=access_denied',
    };
    const history = {
      replaceState(_data: unknown, _unused: string, url?: string | null) {
        current = `http://localhost:5173${url ?? ''}`;
      },
    };

    const params = captureAndStripCallbackUrl(location, history);

    expect(params).toEqual({ code: 'auth_code_abc', state: 'csrf123', error: 'access_denied' });
    expect(current).toBe('http://localhost:5173/auth/openrouter/callback');
    expect(current).not.toContain('code=');
    expect(current).not.toContain('state=');
  });

  it('prefers the pre-React stash and does not leave code on the window object', () => {
    const { win, getHref } = fakeWindow('http://localhost:5173/auth/openrouter/callback', {
      code: 'stashed-code',
      state: 'stashed-state',
      error: null,
    });

    const params = captureCallbackFromWindow(win);

    expect(params).toEqual({ code: 'stashed-code', state: 'stashed-state', error: null });
    expect(takeStashedCallback(win)).toBeUndefined();
    expect(getHref()).toBe('http://localhost:5173/auth/openrouter/callback');
  });
});
