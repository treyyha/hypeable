/**
 * Commit-message argv parsing for `npm run ship`.
 *
 * npm and PowerShell both split on spaces and can drop quotes around
 * `feat(scope): summary (note)`. Joining leftover non-flag args is how a
 * message with spaces and parentheses survives on Windows.
 */
export function parseShipArgs(argv) {
  const flags = new Set();
  const parts = [];

  for (const arg of argv) {
    if (arg === '--') {
      continue;
    }

    if (arg.startsWith('--')) {
      flags.add(arg);
      continue;
    }

    parts.push(arg);
  }

  return { flags, message: parts.join(' ').trim() };
}
