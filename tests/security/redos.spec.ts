/**
 * Catastrophic-backtracking checks for the regexes that see untrusted text:
 * terminal/error output (loop breaker), generated or imported project files
 * (pre-deploy scan), and anything we log (redaction). Each runs on the main
 * thread or in the Worker's CPU budget, so super-linear time is a freeze.
 *
 * Inputs are sized so a linear regex finishes in a few milliseconds and a
 * quadratic one takes seconds.
 */
import { describe, expect, it } from 'vitest';
import { signatureFromError } from '~/lib/loop/normalize';
import { scan } from '~/lib/predeploy/scan';
import { redact } from '~/lib/security/redact';

const N = 50_000;

function timed(run: () => unknown): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

/** Generous for slow CI runners, far below what an O(n^2) pass over 50k chars needs. */
const BUDGET_MS = 400;

const ADVERSARIAL_LINES: Record<string, string> = {
  'long word, no separators': 'a'.repeat(N),
  'dotted word, no slash': 'a.'.repeat(N / 2),
  'path-like, no final segment': 'a/'.repeat(N / 2) + '!',
  'backslash path, open': 'C:\\' + 'a\\'.repeat(N / 2),
  'role assignments, no storage': 'role='.repeat(N / 5),
  'isAdmin assignments, no storage': 'isAdmin = x; '.repeat(N / 13),
  'useState with admin, never closed': 'useState('.repeat(N / 9),
  'alloworigin, no star': 'alloworigin'.repeat(N / 11),
  'access-control, no star': 'access-control-allow-origin: '.repeat(N / 29),
  'create policy, no true': 'create policy anon for all with check ('.repeat(N / 40),
  'hardcoded assignment, short values': 'api_key = "abc" '.repeat(N / 16),
  'bearer tokens': 'Bearer '.repeat(N / 7),
  'sk- prefixes': 'sk-'.repeat(N / 3),
  'eyJ prefixes': 'eyJ.'.repeat(N / 4),
  'setItem token, unterminated': "localStorage.setItem('token".repeat(N / 27),
  'dangerouslySetInnerHTML, open': 'dangerouslySetInnerHTML={{ __html: '.repeat(N / 36),
  'from table, open': ".from('x".repeat(N / 8),
  'version-ish': '1.2.'.repeat(N / 4),
  'colons and digits': ':1:2'.repeat(N / 4),
  'ports': 'port '.repeat(N / 5),
  'ANSI fragments': '\u001b[1;2;3'.repeat(N / 7),
};

describe('ReDoS: loop breaker signature', () => {
  it.each(Object.entries(ADVERSARIAL_LINES))('%s stays linear', (_label, text) => {
    expect(timed(() => signatureFromError(text))).toBeLessThan(BUDGET_MS);
  });
});

describe('ReDoS: pre-deploy scan', () => {
  it.each(Object.entries(ADVERSARIAL_LINES))('%s stays linear', (_label, text) => {
    const files = {
      'src/App.tsx': text,
      'api/handler.ts': text,
      'supabase/migrations/1.sql': text,
      'firestore.rules': text,
      '.env': `KEY=${text}`,
      'package.json': `{"dependencies":{"x":"${text.replace(/["\\]/g, '')}"}}`,
    };

    expect(timed(() => scan(files))).toBeLessThan(BUDGET_MS * 3);
  });
});

describe('ReDoS: log redaction', () => {
  it.each(Object.entries(ADVERSARIAL_LINES))('%s stays linear', (_label, text) => {
    expect(timed(() => redact(text))).toBeLessThan(BUDGET_MS);
  });
});
