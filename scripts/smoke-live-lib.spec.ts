import { describe, expect, it, vi } from 'vitest';
import { commitsMatch, parseSmokeLiveArgs, waitForCommit } from './smoke-live-lib.mjs';

describe('parseSmokeLiveArgs', () => {
  it('reads the URL and --expect-commit in either order', () => {
    expect(parseSmokeLiveArgs(['https://hypeable.dev', '--expect-commit', 'abc1234'])).toEqual({
      url: 'https://hypeable.dev',
      expectCommit: 'abc1234',
    });
    expect(parseSmokeLiveArgs(['--expect-commit=deadbeef', 'https://example.test'])).toEqual({
      url: 'https://example.test',
      expectCommit: 'deadbeef',
    });
  });

  it('leaves url empty when omitted so the script defaults to hypeable.dev', () => {
    expect(parseSmokeLiveArgs([])).toEqual({ url: '', expectCommit: '' });
    expect(parseSmokeLiveArgs(['--expect-commit', 'abc1234'])).toEqual({
      url: '',
      expectCommit: 'abc1234',
    });
  });
});

describe('commitsMatch', () => {
  it('matches full SHA, prefix, and mixed case', () => {
    expect(commitsMatch('ABCDEF1234567890', 'abcdef1234567890')).toBe(true);
    expect(commitsMatch('abcdef1234567890', 'abcdef1')).toBe(true);
    expect(commitsMatch('abcdef1', 'abcdef1234567890')).toBe(true);
    expect(commitsMatch('aaaaaaa', 'bbbbbbb')).toBe(false);
  });
});

describe('waitForCommit', () => {
  it('returns once /api/health reports the expected commit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, hosted: true, commit: 'abc1234ffff' }),
    });

    await expect(
      waitForCommit({
        origin: 'https://hypeable.dev',
        expected: 'abc1234',
        fetchImpl,
        timeoutMs: 1000,
        intervalMs: 10,
        sleep: async () => undefined,
      }),
    ).resolves.toBe('abc1234ffff');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws after the deadline when the commit never matches', async () => {
    let t = 0;

    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, hosted: true, commit: 'other' }),
    });

    await expect(
      waitForCommit({
        origin: 'https://hypeable.dev',
        expected: 'abc1234',
        fetchImpl,
        timeoutMs: 20,
        intervalMs: 10,
        now: () => t,
        sleep: async (ms) => {
          t += ms;
        },
      }),
    ).rejects.toThrow(/did not match abc1234/);
  });
});
