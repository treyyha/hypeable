import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Preference cookies used to ride along with every same-origin request.
 * Production app code must not write them. Tests may still set leftover
 * cookies to prove migration deletes them.
 */

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'app');
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs']);

const FORBIDDEN = [
  /Cookies\.set\s*\(/,
  /document\.cookie\s*=\s*[`'"](?:selectedModel|selectedProvider|providers|cachedPrompt|agentMode|isDebugEnabled|eventLogs|tabConfiguration)=/,
];

function walk(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (entry === 'node_modules') {
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

describe('app code must not write preference cookies', () => {
  it('finds no Cookies.set under app/', () => {
    const files = walk(APP_DIR, []);
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
