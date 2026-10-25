/**
 * Git credentials for isomorphic-git in the browser.
 *
 * Stored in localStorage, never cookies — cookies attach to every same-origin
 * request. Legacy `git:*` / token cookies are deleted on write so they stop
 * riding along with later fetches.
 */
import Cookies from 'js-cookie';

const PREFIX = 'git:';

export type StoredGitAuth = { username: string; password: string };

const LEGACY_TOKEN_COOKIES = [
  'apiKeys',
  'githubToken',
  'gitlabToken',
  'netlifyToken',
  'VITE_VERCEL_ACCESS_TOKEN',
] as const;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split('/')[2];
  }
}

export function lookupGitAuth(url: string): StoredGitAuth | null {
  if (!canUseStorage()) {
    return null;
  }

  const host = hostOf(url);

  if (!host) {
    return null;
  }

  const raw = window.localStorage.getItem(`${PREFIX}${host}`);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredGitAuth;

    if (parsed?.username && parsed?.password) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function saveGitAuth(url: string, auth: StoredGitAuth): void {
  if (!canUseStorage() || !auth.username || !auth.password) {
    return;
  }

  const host = hostOf(url);

  if (!host) {
    return;
  }

  window.localStorage.setItem(`${PREFIX}${host}`, JSON.stringify({ username: auth.username, password: auth.password }));
  deleteLegacyTokenCookies();
}

export function clearGitAuth(host: string): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(`${PREFIX}${host}`);
  Cookies.remove(`${PREFIX}${host}`);
  Cookies.remove(`${PREFIX}${host}`, { path: '/' });
}

export function deleteLegacyTokenCookies(): void {
  if (typeof document === 'undefined') {
    return;
  }

  for (const name of LEGACY_TOKEN_COOKIES) {
    Cookies.remove(name);
    Cookies.remove(name, { path: '/' });
  }

  Cookies.remove('git:github.com');
  Cookies.remove('git:github.com', { path: '/' });
  Cookies.remove('git:gitlab.com');
  Cookies.remove('git:gitlab.com', { path: '/' });
}

export function authorizationHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function readStoredConnection(kind: 'github' | 'gitlab'): { token?: string; username?: string } {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(`${kind}_connection`);
    const parsed = raw ? (JSON.parse(raw) as { token?: string; user?: { login?: string; username?: string } }) : null;

    return {
      token: parsed?.token,
      username: parsed?.user?.login || parsed?.user?.username,
    };
  } catch {
    return {};
  }
}
