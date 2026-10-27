#!/usr/bin/env node
/**
 * Fail CI if the production home route's static JS/CSS (gzip) exceeds the budget.
 * Usage: node scripts/check-first-load-budget.mjs
 * Requires `pnpm build` first.
 *
 * This app is SSR: there is no build/client/index.html. We walk static imports
 * from the home entry chunks and ignore dynamic import() (Workbench, Shiki, xterm).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'build', 'client', 'assets');
const budgetPath = join(root, 'docs', 'first-load-budget.json');
const staticImportRe = /from\s*["'](\.\/[^"']+\.(?:js|css))["']/g;

if (!existsSync(assetsDir)) {
  console.error('Missing build/client/assets. Run pnpm build first.');
  process.exit(1);
}

const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const names = readdirSync(assetsDir);

function findOne(pattern) {
  const match = names.find((name) => pattern.test(name));

  if (!match) {
    throw new Error(`No asset matching ${pattern} in ${assetsDir}`);
  }

  return match;
}

const seeds = [
  findOne(/^entry\.client-.*\.js$/),
  findOne(/^root-.*\.js$/),
  findOne(/^_index-.*\.js$/),
  findOne(/^root-.*\.css$/),
  findOne(/^index-BpWZv4JI\.css$|^index-.*\.css$/),
  names.find((name) => /^ReactToastify-.*\.css$/.test(name)),
  names.find((name) => /^tailwind-compat-.*\.css$/.test(name)),
].filter(Boolean);

const seen = new Set();
const queue = [...seeds];

while (queue.length > 0) {
  const name = queue.pop();

  if (!name || seen.has(name)) {
    continue;
  }

  seen.add(name);

  const filePath = join(assetsDir, name);

  if (!existsSync(filePath) || !name.endsWith('.js')) {
    continue;
  }

  const src = readFileSync(filePath, 'utf8');

  for (const match of src.matchAll(staticImportRe)) {
    const ref = match[1].replace(/^\.\//, '');

    if (!seen.has(ref)) {
      queue.push(ref);
    }
  }
}

let jsRaw = 0;
let jsGzip = 0;
let cssRaw = 0;
let cssGzip = 0;

const files = [];

for (const name of [...seen].sort()) {
  const filePath = join(assetsDir, name);

  if (!existsSync(filePath)) {
    continue;
  }

  const buf = readFileSync(filePath);
  const gzipped = gzipSync(buf, { level: 9 });
  const isJs = name.endsWith('.js');

  if (isJs) {
    jsRaw += buf.length;
    jsGzip += gzipped.length;
  } else {
    cssRaw += buf.length;
    cssGzip += gzipped.length;
  }

  files.push({
    ref: `/assets/${name}`,
    raw: buf.length,
    gzip: gzipped.length,
  });
}

console.log(`First-load from ${assetsDir} (static graph of home entries)`);
console.log(`Requests (JS+CSS in static graph): ${files.length}`);
console.log(`JS  raw ${(jsRaw / 1024).toFixed(1)} KiB  gzip ${(jsGzip / 1024).toFixed(1)} KiB`);
console.log(`CSS raw ${(cssRaw / 1024).toFixed(1)} KiB  gzip ${(cssGzip / 1024).toFixed(1)} KiB`);

const top = [...files].sort((a, b) => b.gzip - a.gzip).slice(0, 15);
console.log('Largest in graph:');

for (const file of top) {
  console.log(`  ${(file.gzip / 1024).toFixed(1).padStart(6)} KiB gzip  ${file.ref.replace('/assets/', '')}`);
}

const forbidden = [...seen].filter(
  (name) =>
    name.startsWith('Workbench.client') ||
    name.startsWith('Chat.client') ||
    name.startsWith('Menu.client') ||
    name.startsWith('ControlPanel') ||
    name.startsWith('provider-list') ||
    name.startsWith('FirstRunOnboarding') ||
    name.startsWith('xterm-') ||
    /^(typescript|cpp|wasm|emacs-lisp)-/.test(name),
);

if (forbidden.length > 0) {
  console.error(`Home static graph includes deferred chunks: ${forbidden.join(', ')}`);
  process.exit(1);
}

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
