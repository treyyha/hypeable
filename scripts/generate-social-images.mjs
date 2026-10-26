#!/usr/bin/env node
/*
 * Rasterize brand SVGs with Playwright.
 *   node scripts/generate-social-images.mjs
 */
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

async function rasterizeSvg(page, svgFile, width, height, outFile) {
  const href = pathToFileURL(join(root, svgFile)).href;
  await page.setViewportSize({ width, height });
  await page.goto(href, { waitUntil: 'load' });
  await page.screenshot({ path: join(root, outFile), type: 'png', clip: { x: 0, y: 0, width, height } });
  console.log(`wrote ${outFile} (${width}x${height})`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

await rasterizeSvg(page, 'public/og.svg', 1200, 630, 'public/og.png');
await rasterizeSvg(page, 'public/social-preview.svg', 1280, 640, 'docs/assets/social-preview.png');
await rasterizeSvg(page, 'public/apple-touch-icon.svg', 180, 180, 'public/apple-touch-icon.png');

await browser.close();
