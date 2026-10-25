#!/usr/bin/env node
// One-time repo setup: hooks, env file, sanity scan.
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, chmodSync } from 'node:fs';
const sh = (c, a) => spawnSync(c, a, { stdio: 'inherit', shell: process.platform === 'win32' });
sh('git', ['config', 'core.hooksPath', '.githooks']);
for (const h of ['pre-commit', 'commit-msg']) { try { chmodSync(`.githooks/${h}`, 0o755); } catch {} }
if (!existsSync('.env.local') && existsSync('.env.example')) { copyFileSync('.env.example', '.env.local'); console.log('created .env.local (git-ignored). Fill in YOUR local keys there.'); }
sh('git', ['update-index', '--chmod=+x', '.githooks/pre-commit']);
sh('node', ['scripts/secret-scan.mjs', '--all']);
console.log('\n✅ setup done: hooks active (secret scan + conventional commits).');
