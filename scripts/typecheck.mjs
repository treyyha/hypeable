#!/usr/bin/env node
// Incremental `tsc`. Cache lives under node_modules/.cache so it is gitignored.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'node_modules', '.cache'), { recursive: true });

const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const result = spawnSync(process.execPath, [tsc], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
