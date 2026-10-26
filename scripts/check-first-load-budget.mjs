#!/usr/bin/env node
/**
 * Fail CI if the production home document's JS (gzip) exceeds the budget.
 * Usage: node scripts/check-first-load-budget.mjs
 * Requires `pnpm build` first.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = join(root, 'build', 'client');
const htmlPath = join(clientDir, 'index.html');
const budgetPath = join(root, 'docs', 'first-load-budget.json');

if (!existsSync(htmlPath)) {
  console.error('Missing build/client/index.html. Run pnpm build first.');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const refs = new Set();

for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)) {
  refs.add(match[1]);
}

for (const match of html.matchAll(/modulepreload[^>]+href="(\/assets\/[^"]+\.js)"/g)) {
  refs.add(match[1]);
}

let jsRaw = 0;
let jsGzip = 0;
let cssRaw = 0;
let cssGzip = 0;

const files = [];

for (const ref of [...refs].sort()) {
  const filePath = join(clientDir, ref.replace(/^\//, ''));

  if (!existsSync(filePath)) {
    continue;
  }

  const buf = readFileSync(filePath);
  const gzipped = gzipSync(buf, { level: 9 });
  const isJs = ref.endsWith('.js');

  if (isJs) {
    jsRaw += buf.length;
    jsGzip += gzipped.length;
  } else {
    cssRaw += buf.length;
    cssGzip += gzipped.length;
  }

  files.push({
    ref,
    raw: buf.length,
    gzip: gzipped.length,
  });
}

const report = {
  requests: files.length,
  jsRaw,
  jsGzip,
  cssRaw,
  cssGzip,
  files,
};

console.log(`First-load from ${htmlPath}`);
console.log(`Requests (JS+CSS in document): ${report.requests}`);
console.log(`JS  raw ${(jsRaw / 1024).toFixed(1)} KiB  gzip ${(jsGzip / 1024).toFixed(1)} KiB`);
console.log(`CSS raw ${(cssRaw / 1024).toFixed(1)} KiB  gzip ${(cssGzip / 1024).toFixed(1)} KiB`);

const jsBudget = budget.jsGzipBytes;
const cssBudget = budget.cssGzipBytes;

let failed = false;

if (jsGzip > jsBudget) {
  console.error(`JS gzip ${(jsGzip / 1024).toFixed(1)} KiB exceeds budget ${(jsBudget / 1024).toFixed(1)} KiB`);
  failed = true;
}

if (cssGzip > cssBudget) {
  console.error(`CSS gzip ${(cssGzip / 1024).toFixed(1)} KiB exceeds budget ${(cssBudget / 1024).toFixed(1)} KiB`);
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  `Within budget (JS gzip ≤ ${(jsBudget / 1024).toFixed(0)} KiB, CSS gzip ≤ ${(cssBudget / 1024).toFixed(0)} KiB).`,
);
