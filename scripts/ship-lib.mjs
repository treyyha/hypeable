/**
 * Commit-message argv parsing for `npm run ship`.
 *
 * npm and PowerShell both split on spaces and can drop quotes around
 * `feat(scope): summary (note)`. Joining leftover non-flag args is how a
 * message with spaces and parentheses survives on Windows.
 *
 * Commit bodies are passed separately: `--body "why"` or `--body-file path`.
 * npm on Windows drops multiline `-m` strings, so the body is a second
 * `git commit -m` argument rather than a newline inside the subject.
 */
import { readFileSync } from 'node:fs';

export function parseShipArgs(argv) {
  const flags = new Set();
  const titleParts = [];
  const bodyParts = [];

  let bodyFile = '';
  let mode = 'title';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      continue;
    }

    if (arg === '--body' || arg.startsWith('--body=')) {
      if (arg.startsWith('--body=') && arg.length > '--body='.length) {
        bodyParts.push(arg.slice('--body='.length));
      }

      mode = 'body';
      continue;
    }

    if (arg === '--body-file' || arg.startsWith('--body-file=')) {
      bodyFile = arg.startsWith('--body-file=') ? arg.slice('--body-file='.length) : (argv[++i] ?? '');
      continue;
    }

    if (arg.startsWith('--')) {
      flags.add(arg);
      continue;
    }

    if (mode === 'body') {
      bodyParts.push(arg);
    } else {
      titleParts.push(arg);
    }
  }

  return {
    flags,
    message: titleParts.join(' ').trim(),
    body: bodyParts.join(' ').trim(),
    bodyFile,
  };
}

export function resolveShipBody({ body = '', bodyFile = '' } = {}, readFile = (path) => readFileSync(path, 'utf8')) {
  if (body) {
    return body;
  }

  if (bodyFile) {
    return String(readFile(bodyFile)).replace(/\s+$/u, '');
  }

  return '';
}

export function gitCommitArgs(message, body = '') {
  const args = ['commit', '-m', message];

  if (body) {
    args.push('-m', body);
  }

  return args;
}
