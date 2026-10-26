/**
 * Turn a workbench file map into scan input. Skip junk the user did not write.
 */

import type { ScanFileEntry } from './types';

const MAX_BYTES = 1_000_000;

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.cache',
  '.next',
  '.output',
  '.nuxt',
  'coverage',
  'vendor',
]);
const SKIP_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
  'gemfile.lock',
  'go.sum',
]);

export function relativeScanPath(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/');
  const prefix = '/home/project/';

  if (normalized === '/home/project') {
    return '';
  }

  if (normalized.startsWith(prefix)) {
    return normalized.slice(prefix.length);
  }

  return normalized.replace(/^\//, '');
}

export function shouldSkipScanPath(relPath: string, content: string): boolean {
  if (content.length > MAX_BYTES || content.includes('\0')) {
    return true;
  }

  const parts = relPath.replace(/\\/g, '/').split('/').filter(Boolean);
  const base = (parts[parts.length - 1] ?? '').toLowerCase();

  if (SKIP_FILES.has(base)) {
    return true;
  }

  return parts.some((part) => SKIP_DIRS.has(part));
}

export function collectScanFiles(fileMap: Record<string, ScanFileEntry | undefined>): Record<string, string> {
  const files: Record<string, string> = {};

  for (const [absPath, dirent] of Object.entries(fileMap)) {
    if (!dirent || dirent.type !== 'file' || dirent.isBinary || typeof dirent.content !== 'string') {
      continue;
    }

    const relPath = relativeScanPath(absPath) || absPath.replace(/\\/g, '/').replace(/^\//, '');

    if (shouldSkipScanPath(relPath, dirent.content)) {
      continue;
    }

    files[relPath] = dirent.content;
  }

  return files;
}

export function fingerprintFiles(files: Record<string, string>): string {
  return Object.keys(files)
    .sort()
    .map((path) => `${path}:${files[path]?.length ?? 0}`)
    .join('|');
}

export function filterScanFiles(files: Record<string, string>): { kept: Record<string, string>; skipped: number } {
  const kept: Record<string, string> = {};

  let skipped = 0;

  for (const [path, content] of Object.entries(files)) {
    if (shouldSkipScanPath(path, content)) {
      skipped += 1;
      continue;
    }

    kept[path] = content;
  }

  return { kept, skipped };
}
