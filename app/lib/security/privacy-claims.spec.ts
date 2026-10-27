/**
 * Fails if banned privacy overclaims reappear in README, docs, site copy, or meta.
 * Phrase list: docs/banned-privacy-phrases.json (see docs/CLAIMS.md).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const LIST_PATH = join(ROOT, 'docs/banned-privacy-phrases.json');
const SCAN_EXTENSIONS = new Set(['.md', '.tsx', '.ts', '.txt', '.html', '.json']);

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  '.lighthouse',
  'dist',
]);

type PhraseList = {
  phrases: string[];
  roots: string[];
  exclude: string[];
};

function loadList(): PhraseList {
  return JSON.parse(readFileSync(LIST_PATH, 'utf8')) as PhraseList;
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function shouldSkipFile(rel: string, exclude: Set<string>): boolean {
  if (exclude.has(rel)) {
    return true;
  }

  if (/\.(spec|test)\.(ts|tsx|js|jsx)$/.test(rel)) {
    return true;
  }

  return false;
}

function walkFiles(abs: string, exclude: Set<string>, out: string[]): void {
  const rel = toPosix(relative(ROOT, abs));
  const stats = statSync(abs);

  if (stats.isDirectory()) {
    if (SKIP_DIR_NAMES.has(rel.split('/').pop() ?? '')) {
      return;
    }

    for (const entry of readdirSync(abs)) {
      walkFiles(join(abs, entry), exclude, out);
    }

    return;
  }

  if (!SCAN_EXTENSIONS.has(extname(abs).toLowerCase())) {
    return;
  }

  if (shouldSkipFile(rel, exclude)) {
    return;
  }

  out.push(abs);
}

describe('banned privacy phrases', () => {
  it('do not appear in README, docs, site copy, or meta', () => {
    const list = loadList();
    expect(list.phrases.length).toBeGreaterThan(0);

    const exclude = new Set(list.exclude.map(toPosix));
    const files: string[] = [];

    for (const root of list.roots) {
      walkFiles(join(ROOT, root), exclude, files);
    }

    expect(files.length).toBeGreaterThan(20);

    const hits: string[] = [];

    const patterns = list.phrases.map((phrase) => ({
      phrase,
      re: new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    }));

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const rel = toPosix(relative(ROOT, file));

      for (const { phrase, re } of patterns) {
        if (re.test(text)) {
          hits.push(`${rel}: "${phrase}"`);
        }
      }
    }

    expect(hits, hits.join('\n')).toEqual([]);
  });
});
