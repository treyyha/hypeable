/**
 * Build-time commit identity. Workers Builds sets WORKERS_CI_COMMIT_SHA;
 * local and CI builds fall back to `git rev-parse HEAD`.
 */
import { execSync } from 'node:child_process';

export function resolveCommitSha(
  env: NodeJS.Dict<string | undefined> = process.env,
  gitHead: () => string = () => execSync('git rev-parse HEAD', { encoding: 'utf8' }),
): string {
  const fromCi = env.WORKERS_CI_COMMIT_SHA?.trim();

  if (fromCi) {
    return fromCi;
  }

  try {
    const sha = gitHead().trim();

    return sha || 'unknown';
  } catch {
    return 'unknown';
  }
}
