import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseShipArgs } from './ship-lib.mjs';

describe('parseShipArgs', () => {
  it('keeps a quoted conventional message with spaces and parentheses', () => {
    expect(parseShipArgs(['feat(hooks): cut commit time (windows)'])).toEqual({
      flags: new Set(),
      message: 'feat(hooks): cut commit time (windows)',
    });
  });

  it('rejoins args when npm or PowerShell splits on spaces', () => {
    expect(parseShipArgs(['feat(hooks):', 'cut', 'commit', 'time', '(windows)']).message).toBe(
      'feat(hooks): cut commit time (windows)',
    );
  });

  it('ignores flags and a bare -- separator', () => {
    const parsed = parseShipArgs(['--', '--no-verify-checks', 'chore(scripts): local ship only']);
    expect(parsed.flags.has('--no-verify-checks')).toBe(true);
    expect(parsed.message).toBe('chore(scripts): local ship only');
  });

  it('preserves parentheses when Node receives the message as one argv entry', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', 'console.log(process.argv[1])', 'feat(hooks): cut time (windows)'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('feat(hooks): cut time (windows)');
  });
});
