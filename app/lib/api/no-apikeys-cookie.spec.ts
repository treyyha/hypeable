import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The `apiKeys` cookie used to ride along with every same-origin request.
 * Server code must never read it. Keys arrive in `x-hypeable-key` (or a body
 * field on older clients). This walks server files so a regression fails CI.
 */

const ROOT = process.cwd();

const SERVER_DIRS = [join(ROOT, 'app', 'routes'), join(ROOT, 'app', 'lib', '.server'), join(ROOT, 'workers')];

const SERVER_FILES = [
  join(ROOT, 'app', 'entry.server.tsx'),
  join(ROOT, 'app', 'lib', 'security.ts'),
  join(ROOT, 'app', 'lib', 'api', 'request-keys.ts'),
  join(ROOT, 'app', 'lib', 'api', 'cookies.ts'),
  join(ROOT, 'app', 'lib', 'api', 'connector-tokens.ts'),
];

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs']);

const FORBIDDEN = [
  /\bcookies\.apiKeys\b/,
  /\bcookies\[\s*['"]apiKeys['"]\s*\]/,
  /\.get\(\s*['"]apiKeys['"]\s*\)/,
  /startsWith\(\s*['"]apiKeys=/,
  /parseCookies\([^)]*\)\.apiKeys\b/,
];

function walk(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.endsWith('.spec.ts') || entry.endsWith('.spec.tsx')) {
        continue;
      }

      walk(full, acc);
      continue;
    }

    if (CODE_EXT.has(extname(entry)) && !entry.includes('.spec.') && !entry.includes('.test.')) {
      acc.push(full);
    }
  }

  return acc;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('server code must not read the apiKeys cookie', () => {
  it('finds no cookies.apiKeys (or equivalent) reads under server paths', () => {
    const files = [...SERVER_FILES, ...SERVER_DIRS.flatMap((dir) => walk(dir, []))];
    const hits: string[] = [];

    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));

      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          hits.push(`${relative(ROOT, file)} matches ${pattern}`);
        }
      }
    }

    expect(hits).toEqual([]);
  });
});
