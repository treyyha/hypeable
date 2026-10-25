#!/usr/bin/env node
// One-time repo setup: env file + sanity scan. Git hooks live in .husky/ (installed by pnpm install / husky prepare).
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';

if (!existsSync('.env.local') && existsSync('.env.example')) {
  copyFileSync('.env.example', '.env.local');
  console.log('created .env.local (git-ignored). Fill in YOUR local keys there.');
}

const scan = spawnSync('node', ['scripts/secret-scan.mjs', '--all'], { stdio: 'inherit' });
if (scan.status !== 0) {
  process.exit(scan.status ?? 1);
}

console.log('\n✅ setup done: .env.local ready, secret-scan clean. Hooks are Husky (.husky/).');
