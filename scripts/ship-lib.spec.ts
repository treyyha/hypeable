import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { gitCommitArgs, parseShipArgs, resolveShipBody } from './ship-lib.mjs';

describe('parseShipArgs', () => {
  it('keeps a quoted conventional message with spaces and parentheses', () => {
    expect(parseShipArgs(['feat(hooks): cut commit time (windows)'])).toEqual({
      flags: new Set(),
      message: 'feat(hooks): cut commit time (windows)',
      body: '',
      bodyFile: '',
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

  it('collects --body after the subject, including split words', () => {
    const parsed = parseShipArgs([
      'fix(cost):',
      'show',
      'spend',
      'on',
      'the',
      'header',
      'pill',
      '--body',
      'UnoCSS',
      'opacity',
      'modifiers',
      'became',
      'a',
      'solid',
      'fill.',
    ]);
    expect(parsed.message).toBe('fix(cost): show spend on the header pill');
    expect(parsed.body).toBe('UnoCSS opacity modifiers became a solid fill.');
  });

  it('accepts --body=value and --body-file path', () => {
    const inline = parseShipArgs(['chore(scripts): keep why', '--body=Windows drops newlines.']);
    expect(inline.body).toBe('Windows drops newlines.');

    const fromFile = parseShipArgs(['chore(scripts): keep why', '--body-file', 'notes/why.txt']);
    expect(fromFile.bodyFile).toBe('notes/why.txt');
    expect(fromFile.body).toBe('');

    const equalsFile = parseShipArgs(['chore(scripts): keep why', '--body-file=notes/why.txt']);
    expect(equalsFile.bodyFile).toBe('notes/why.txt');
  });
});

describe('resolveShipBody', () => {
  it('prefers --body over --body-file', () => {
    expect(
      resolveShipBody({ body: 'from flag', bodyFile: 'why.txt' }, () => {
        throw new Error('should not read the file');
      }),
    ).toBe('from flag');
  });

  it('reads --body-file when --body is empty', () => {
    expect(resolveShipBody({ body: '', bodyFile: 'why.txt' }, (path) => `contents of ${path}\n`)).toBe(
      'contents of why.txt',
    );
  });
});

describe('gitCommitArgs', () => {
  it('passes the why paragraph as a second -m so Windows npm cannot drop it', () => {
    expect(gitCommitArgs('fix(cost): show spend on the header pill', 'Text equalled fill.')).toEqual([
      'commit',
      '-m',
      'fix(cost): show spend on the header pill',
      '-m',
      'Text equalled fill.',
    ]);
  });

  it('omits the extra -m when there is no body', () => {
    expect(gitCommitArgs('chore(scripts): local ship only')).toEqual([
      'commit',
      '-m',
      'chore(scripts): local ship only',
    ]);
  });
});
