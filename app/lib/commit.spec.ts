import { describe, expect, it } from 'vitest';
import { githubCommitUrl, shortCommit, versionLine } from './commit';

describe('build info helpers', () => {
  it('shortens a full SHA to seven characters', () => {
    expect(shortCommit('abcdef1234567890')).toBe('abcdef1');
  });

  it('keeps unknown as unknown', () => {
    expect(shortCommit('unknown')).toBe('unknown');
  });

  it('formats the footer version line', () => {
    expect(versionLine('0.1.0', 'abcdef1234567890')).toBe('v0.1.0 . abcdef1');
    expect(versionLine('v0.1.0', 'unknown')).toBe('v0.1.0 . unknown');
  });

  it('builds a GitHub commit URL only for real SHAs', () => {
    expect(githubCommitUrl('https://github.com/treyyha/hypeable', 'abcdef1234567890')).toBe(
      'https://github.com/treyyha/hypeable/commit/abcdef1234567890',
    );
    expect(githubCommitUrl('https://github.com/treyyha/hypeable.git', 'unknown')).toBeUndefined();
  });
});
