#!/usr/bin/env node
// Run Vitest related-mode on files changed vs HEAD (staged, unstaged, untracked).
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;

function lines(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', cwd: root })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const files = [
  ...new Set([
    ...lines('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']),
    ...lines('git', ['ls-files', '--others', '--exclude-standard']),
  ]),
].filter((file) => SOURCE.test(file));

if (files.length === 0) {
  console.log('test:related: no changed source files');
  process.exit(0);
}

const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');

const result = spawnSync(process.execPath, [vitest, 'related', '--run', '--passWithNoTests', ...files], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 1);
