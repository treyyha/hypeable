#!/usr/bin/env node
/**
 * One-shot: load / on Chromium with Fast 4G and print transfer stats.
 * Requires the app on http://localhost:5173 (dev or preview).
 *
 * Fast 4G here matches Chrome DevTools: 9 Mbps down, 1.5 Mbps up, 170 ms RTT.
 */
import { chromium } from '@playwright/test';

const FAST_4G = {
  offline: false,
  downloadThroughput: Math.round((9 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((1.5 * 1024 * 1024) / 8),
  latency: 170,
};

const url = process.argv[2] || 'http://localhost:5173/';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const client = await page.context().newCDPSession(page);

await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', FAST_4G);

const started = Date.now();
await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });

const loadMs = Date.now() - started;

const perf = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');

  let transfer = nav ? nav.transferSize : 0;
  let encoded = nav ? nav.encodedBodySize : 0;
  let js = 0;
  let css = 0;
  let jsEncoded = 0;
  let cssEncoded = 0;
  let requests = 1;

  for (const entry of resources) {
    transfer += entry.transferSize;
    encoded += entry.encodedBodySize;
    requests += 1;

    if (entry.name.includes('.js') || entry.initiatorType === 'script') {
      js += entry.transferSize;
      jsEncoded += entry.encodedBodySize;
    }

    if (entry.name.includes('.css') || entry.initiatorType === 'link') {
      css += entry.transferSize;
      cssEncoded += entry.encodedBodySize;
    }
  }

  return {
    transfer,
    encoded,
    js,
    css,
    jsEncoded,
    cssEncoded,
    requests,
    duration: nav ? nav.duration : loadMs,
  };
});

console.log(
  JSON.stringify(
    {
      url,
      profile: 'Fast 4G (9 Mbps / 1.5 Mbps / 170 ms)',
      wallClockMs: loadMs,
      navigationDurationMs: Math.round(perf.duration),
      requests: perf.requests,
      transferBytes: perf.transfer,
      encodedBytes: perf.encoded,
      jsTransferBytes: perf.js,
      cssTransferBytes: perf.css,
      jsEncodedBytes: perf.jsEncoded,
      cssEncodedBytes: perf.cssEncoded,
    },
    null,
    2,
  ),
);

await browser.close();
