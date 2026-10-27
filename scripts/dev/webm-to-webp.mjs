#!/usr/bin/env node
/*
 * Convert Playwright demo webms in docs/assets to animated webp under 3 MB.
 * Requires ffmpeg on PATH.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'docs/assets';
const maxBytes = 3 * 1024 * 1024;
const clips = readdirSync(dir).filter((name) => name.startsWith('demo-') && name.endsWith('.webm'));

if (clips.length === 0) {
  console.error('no demo-*.webm files in docs/assets');
  process.exit(1);
}

for (const name of clips) {
  const src = join(dir, name);
  const dest = src.replace(/\.webm$/i, '.webp');
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      src,
      '-vf',
      'fps=12,scale=960:-1:flags=lanczos',
      '-an',
      '-loop',
      '0',
      '-c:v',
      'libwebp',
      '-q:v',
      '50',
      dest,
    ],
    { stdio: 'inherit' },
  );

  const size = statSync(dest).size;

  if (size > maxBytes) {
    console.error(`${dest} is ${(size / 1024 / 1024).toFixed(2)} MB (limit 3)`);
    process.exit(1);
  }

  unlinkSync(src);
  console.log(`ok ${dest} (${Math.round(size / 1024)} KB)`);
}
