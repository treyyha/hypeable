#!/usr/bin/env node
/**
 * Decide whether a CI run is docs-only (skip build/tests/e2e, still run gitleaks).
 * A change is docs-only when every path is markdown, under docs/, or under assets/.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export function isDocsOnlyPath(file) {
  const normalized = file.replaceAll('\\', '/');
  return (
    /\.md$/i.test(normalized) ||
    normalized === 'docs' ||
    normalized.startsWith('docs/') ||
    normalized === 'assets' ||
    normalized.startsWith('assets/') ||
    /(^|\/)assets\//.test(normalized)
  );
}

export function isDocsOnly(files) {
  if (files.length === 0) {
    return false;
  }

  return files.every(isDocsOnlyPath);
}

function changedFiles() {
  const base = process.env.BASE_SHA ?? '';
  const head = process.env.HEAD_SHA ?? process.env.GITHUB_SHA ?? '';

  if (!base || /^0+$/.test(base) || !head) {
    return ['FORCE_HEAVY'];
  }

  return execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function setOutput(heavy) {
  const value = heavy ? 'true' : 'false';

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `heavy=${value}\n`);
  }

  console.log(heavy ? 'heavy checks: yes' : 'docs-only: skip build/tests/e2e');
}

const isMain = process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('ci-docs-only.mjs');

if (isMain) {
  setOutput(!isDocsOnly(changedFiles()));
}
