#!/usr/bin/env node
/*
 * Blocks commits that contain likely secrets. Zero dependencies.
 * Usage: node scripts/secret-scan.mjs            (scans staged changes)
 *        node scripts/secret-scan.mjs --all      (scans all tracked files)
 *        node scripts/secret-scan.mjs --dir build (walks a directory, used in CI)
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const BLOCKED_FILES = [
  /(^|\/)\.env(\.(?!example$)[^/]+)?$/,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_rsa/,
  /(^|\/)\.dev\.vars$/,
  /service-account.*\.json$/i,
];

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/lib/security/secret-patterns.json'), 'utf8'),
);

const PATTERNS = catalog.patterns.map((row) => [row.label, new RegExp(row.source, row.flags || '')]);

const ALLOW_LINE = /secret-scan:allow/;
const SKIP_DIR_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp4|webm|wasm|bin|gz|zip|pdf|map)$/i;
const all = process.argv.includes('--all');
const dirFlag = process.argv.indexOf('--dir');
const scanDir = dirFlag >= 0 ? process.argv[dirFlag + 1] : '';
const problems = [];

function walkDir(root) {
  const out = [];

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }

        visit(full);
        continue;
      }

      if (SKIP_DIR_EXT.test(entry.name)) {
        continue;
      }

      out.push(relative(process.cwd(), full).replaceAll('\\', '/'));
    }
  };

  visit(root);

  return out;
}

const files = scanDir
  ? walkDir(scanDir)
  : all
    ? git('ls-files', '-z').split('\0').filter(Boolean)
    : git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);

for (const f of files) {
  if (BLOCKED_FILES.some((re) => re.test(f))) {
    problems.push(`${f}: file type must never be committed`);
  }
}

function scan(name, text) {
  text.split('\n').forEach((line, i) => {
    if (ALLOW_LINE.test(line)) {
      return;
    }

    for (const [label, re] of PATTERNS) {
      if (re.test(line)) {
        problems.push(`${name}:${i + 1}: looks like ${label}`);
      }
    }
  });
}

if (all || scanDir) {
  for (const f of files) {
    try {
      if (statSync(f).size > 5 * 1024 * 1024) {
        continue;
      }

      const t = readFileSync(f, 'utf8');

      if (!t.includes('\0')) {
        scan(f, t);
      }
    } catch {}
  }
} else {
  const diff = git('diff', '--cached', '-U0', '--no-color');

  let cur = '';

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      cur = line.slice(6);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      scan(cur, line.slice(1));
    }
  }
}

if (problems.length) {
  console.error('\n❌ secret-scan blocked this commit:\n');

  for (const p of [...new Set(problems)]) {
    console.error('  - ' + p);
  }

  console.error('\nFix: move the value to .env.local (git-ignored), reference it via process.env,');
  console.error('and if a real key was ever pasted anywhere, ROTATE it. Deleting it is not enough.');
  console.error('False positive? add "secret-scan:allow" in a comment on that line.\n');
  process.exit(1);
}

console.log('✅ secret-scan: clean (' + files.length + ' files)');
