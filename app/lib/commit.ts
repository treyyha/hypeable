/**
 * Identity baked in at build time via Vite `define`.
 * `__COMMIT_SHA` / `__APP_VERSION` are replaced in the bundle; they are not runtime env.
 */

export const BUILD_COMMIT = typeof __COMMIT_SHA !== 'undefined' && __COMMIT_SHA ? __COMMIT_SHA : 'unknown';
export const BUILD_VERSION = typeof __APP_VERSION !== 'undefined' && __APP_VERSION ? __APP_VERSION : '0.0.0';

export function shortCommit(sha: string): string {
  if (!sha || sha === 'unknown') {
    return 'unknown';
  }

  return sha.slice(0, 7);
}

export function versionLine(version: string, sha: string): string {
  return `v${version.replace(/^v/, '')} . ${shortCommit(sha)}`;
}

export function githubCommitUrl(repoUrl: string, sha: string): string | undefined {
  if (!sha || sha === 'unknown' || sha === 'development') {
    return undefined;
  }

  return `${repoUrl.replace(/\.git$/, '')}/commit/${sha}`;
}
