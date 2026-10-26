import { describe, expect, it } from 'vitest';
import { resolveCommitSha } from './resolve-commit-sha';

describe('resolveCommitSha', () => {
  it('prefers WORKERS_CI_COMMIT_SHA over git', () => {
    const sha = resolveCommitSha({ WORKERS_CI_COMMIT_SHA: ' abcdef123 ' }, () => {
      throw new Error('git should not run');
    });

    expect(sha).toBe('abcdef123');
  });

  it('uses git rev-parse HEAD when the CI var is missing', () => {
    expect(resolveCommitSha({}, () => 'deadbeefcafebabe\n')).toBe('deadbeefcafebabe');
  });

  it('returns unknown when git is unavailable', () => {
    expect(
      resolveCommitSha({}, () => {
        throw new Error('not a git repo');
      }),
    ).toBe('unknown');
  });
});
