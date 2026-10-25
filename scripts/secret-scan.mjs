#!/usr/bin/env node
// Blocks commits that contain likely secrets. Zero dependencies.
// Usage: node scripts/secret-scan.mjs            (scans staged changes)
//        node scripts/secret-scan.mjs --all      (scans all tracked files)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const BLOCKED_FILES = [/(^|\/)\.env(\.(?!example$)[^/]+)?$/, /\.(pem|key|p12|pfx)$/i, /(^|\/)id_rsa/, /(^|\/)\.dev\.vars$/, /service-account.*\.json$/i];

const PATTERNS = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ['OpenRouter key', /sk-or-v1-[A-Za-z0-9]{20,}/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe key', /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['Vercel token', /\b(?:vercel_|vcp_)[A-Za-z0-9]{20,}/],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Hardcoded secret assignment', /\b(?:api[_-]?key|secret|token|password|passwd)\b['"]?\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{20,}['"]/i],
];

const ALLOW_LINE = /secret-scan:allow/;
const all = process.argv.includes('--all');
const problems = [];

const files = all
  ? git('ls-files', '-z').split('\0').filter(Boolean)
  : git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);

for (const f of files) {
  if (BLOCKED_FILES.some((re) => re.test(f))) problems.push(`${f}: file type must never be committed`);
}

function scan(name, text) {
  text.split('\n').forEach((line, i) => {
    if (ALLOW_LINE.test(line)) return;
    for (const [label, re] of PATTERNS) if (re.test(line)) problems.push(`${name}:${i + 1}: looks like ${label}`);
  });
}

if (all) {
  for (const f of files) {
    try { const t = readFileSync(f, 'utf8'); if (!t.includes('\0')) scan(f, t); } catch {}
  }
} else {
  const diff = git('diff', '--cached', '-U0', '--no-color');
  let cur = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) cur = line.slice(6);
    else if (line.startsWith('+') && !line.startsWith('+++')) scan(cur, line.slice(1));
  }
}

if (problems.length) {
  console.error('\n❌ secret-scan blocked this commit:\n');
  for (const p of [...new Set(problems)]) console.error('  - ' + p);
  console.error('\nFix: move the value to .env.local (git-ignored), reference it via process.env,');
  console.error('and if a real key was ever pasted anywhere, ROTATE it. Deleting it is not enough.');
  console.error('False positive? add "secret-scan:allow" in a comment on that line.\n');
  process.exit(1);
}
console.log('✅ secret-scan: clean (' + files.length + ' files)');
