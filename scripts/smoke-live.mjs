#!/usr/bin/env node
/*
 * Live smoke against a deployed Hypeable. Exit 1 on any failure.
 *   npm run smoke:live
 *   npm run smoke:live -- --expect-commit <sha>
 *   npm run smoke:live -- https://hypeable.dev --expect-commit <sha>
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSmokeLiveArgs, waitForCommit } from './smoke-live-lib.mjs';

const CUSTOM = 'Run Hypeable locally to use custom endpoints';

const DISABLED = [
  '/api/mcp-check',
  '/api/system/diagnostics',
  '/api/system/git-info',
  '/api/git-info',
  '/api/check-env-key?provider=OpenAI',
  '/api/configured-providers',
  '/api/system/disk-info',
];

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/lib/security/secret-patterns.json'), 'utf8'),
);

const KEY_PATTERNS = catalog.patterns.map((row) => new RegExp(row.source, row.flags || ''));

const DEFAULT_ORIGIN = 'https://hypeable.dev';

const { url: parsedUrl, expectCommit } = parseSmokeLiveArgs(process.argv.slice(2));
const target = parsedUrl || DEFAULT_ORIGIN;

const origin = new URL(target).origin;

if (expectCommit) {
  try {
    await waitForCommit({ origin, expected: expectCommit });
  } catch (error) {
    console.error('FAIL  ' + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

let failed = 0;

const bodies = [];

function fail(message) {
  failed += 1;
  console.error('FAIL  ' + message);
}

function pass(message) {
  console.log('ok    ' + message);
}

async function get(path, init = {}) {
  const url = origin + path;
  const response = await fetch(url, { redirect: 'manual', ...init });
  const text = await response.text();
  bodies.push({ path, text });

  return { response, text };
}

function assertKeys(label, text) {
  for (const pattern of KEY_PATTERNS) {
    if (pattern.test(text)) {
      fail(`${label}: body matched key pattern ${pattern}`);
    }
  }
}

const home = await get('/');

if (home.response.status !== 200) {
  fail(`GET / → ${home.response.status}, expected 200`);
} else {
  pass('GET / is 200');
}

const headers = home.response.headers;

const needed = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'credentialless',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

for (const [name, value] of Object.entries(needed)) {
  const got = headers.get(name);

  if (!got) {
    fail(`missing ${name}`);
  } else if (got.toLowerCase() !== value) {
    fail(`${name} is ${got}, expected ${value}`);
  } else {
    pass(`${name}: ${got}`);
  }
}

if (!headers.get('content-security-policy-report-only')) {
  fail('missing Content-Security-Policy-Report-Only');
} else {
  pass('CSP-Report-Only present');
}

const connect = await get('/webcontainer/connect/x');

if (connect.response.status !== 404) {
  fail(`GET /webcontainer/connect/x → ${connect.response.status}, expected 404`);
} else {
  pass('/webcontainer/connect is 404');
}

const robots = await get('/robots.txt');

if (robots.response.status !== 200 || !robots.text.includes('Disallow: /api/')) {
  fail(`/robots.txt → ${robots.response.status} ${robots.text.slice(0, 80)}`);
} else {
  pass('robots.txt disallows /api/');
}

const sitemap = await get('/sitemap.xml');

if (sitemap.response.status !== 200 || !sitemap.text.includes('https://hypeable.dev/')) {
  fail(`/sitemap.xml → ${sitemap.response.status}`);
} else {
  pass('sitemap.xml lists the home page');
}

const llms = await get('/llms.txt');

if (llms.response.status !== 200 || !llms.text.toLowerCase().includes('hypeable')) {
  fail(`/llms.txt → ${llms.response.status}`);
} else {
  pass('llms.txt is present');
}

const og = await get('/og.png');

if (og.response.status !== 200 || !(og.response.headers.get('content-type') || '').includes('image/png')) {
  fail(`/og.png → ${og.response.status} ${og.response.headers.get('content-type')}`);
} else {
  pass('og.png is a PNG');
}

const manifest = await get('/site.webmanifest');

if (manifest.response.status !== 200 || !manifest.text.includes('Hypeable')) {
  fail(`/site.webmanifest → ${manifest.response.status}`);
} else {
  pass('site.webmanifest is present');
}

const favicon = await get('/favicon.svg');

if (favicon.response.status !== 200) {
  fail(`/favicon.svg → ${favicon.response.status}`);
} else {
  pass('favicon.svg is present');
}

for (const path of DISABLED) {
  const method = path.includes('mcp-update') ? 'POST' : 'GET';
  const { response } = await get(path, { method });

  if (response.status !== 404) {
    fail(`${method} ${path} → ${response.status}, expected 404`);
  } else {
    pass(`${path} is 404`);
  }
}

const bug = await get('/api/bug-report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});

if (bug.response.status !== 404) {
  fail(`POST /api/bug-report → ${bug.response.status}, expected 404`);
} else {
  pass('/api/bug-report is 404');
}

const update = await get('/api/update', { method: 'POST' });

if (update.response.status !== 404) {
  fail(`POST /api/update → ${update.response.status}, expected 404`);
} else {
  pass('/api/update is 404');
}

const mcp = await get('/api/mcp-update-config', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"mcpServers":{}}',
});

if (mcp.response.status !== 404) {
  fail(`POST /api/mcp-update-config → ${mcp.response.status}, expected 404`);
} else {
  pass('/api/mcp-update-config is 404');
}

const exported = await get('/api/export-api-keys');

if (exported.response.status !== 410) {
  fail(`GET /api/export-api-keys → ${exported.response.status}, expected 410`);
} else {
  pass('/api/export-api-keys is 410');
}

const llm = await get('/api/llmcall', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'hello', model: 'mock-model', provider: { name: 'OpenAILike' } }),
});

if (llm.response.status !== 403 || !llm.text.includes(CUSTOM)) {
  fail(`POST /api/llmcall OpenAILike → ${llm.response.status} ${llm.text.slice(0, 120)}`);
} else {
  pass('OpenAILike llmcall is 403');
}

const git = await get('/api/git-proxy/evil.example/repo.git/info/refs?service=git-upload-pack');

if (git.response.status !== 403 || !git.text.includes(CUSTOM)) {
  fail(`git-proxy evil.example → ${git.response.status} ${git.text.slice(0, 120)}`);
} else {
  pass('git-proxy non-GitHub/GitLab is 403');
}

const gitUserinfo = await get('/api/git-proxy/evil.com@github.com/owner/repo.git/info/refs');

if (gitUserinfo.response.status !== 403) {
  fail(`git-proxy userinfo bypass → ${gitUserinfo.response.status}`);
} else {
  pass('git-proxy userinfo host is 403');
}

const gitOptions = await get('/api/git-proxy/github.com/owner/repo.git/info/refs?service=git-upload-pack', {
  method: 'OPTIONS',
  headers: { Origin: 'https://evil.example' },
});

if (gitOptions.response.headers.get('access-control-allow-origin')) {
  fail(`git-proxy OPTIONS CORS is ${gitOptions.response.headers.get('access-control-allow-origin')}`);
} else {
  pass('git-proxy OPTIONS has no Access-Control-Allow-Origin');
}

const health = await get('/api/health');

let healthJson;

try {
  healthJson = JSON.parse(health.text);
} catch {
  healthJson = null;
}

if (!healthJson || healthJson.ok !== true || healthJson.hosted !== true) {
  fail(`/api/health → ${health.text.slice(0, 160)}, expected {ok:true,hosted:true,commit}`);
} else if (typeof healthJson.commit !== 'string' || !healthJson.commit) {
  fail(`/api/health missing commit: ${health.text.slice(0, 160)}`);
} else {
  pass(`/api/health says hosted:true commit=${healthJson.commit.slice(0, 7)}`);
}

const healthHeaders = health.response.headers;

const apiNeeded = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

for (const [name, value] of Object.entries(apiNeeded)) {
  const got = healthHeaders.get(name);

  if (!got) {
    fail(`/api/health missing ${name}`);
  } else if (got.toLowerCase() !== value) {
    fail(`/api/health ${name} is ${got}, expected ${value}`);
  } else {
    pass(`/api/health ${name}: ${got}`);
  }
}

const healthCache = healthHeaders.get('cache-control') || '';

if (!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(healthCache)) {
  fail(`/api/health Cache-Control is ${healthCache || '(missing)'}, expected no-store`);
} else {
  pass(`/api/health cache-control: ${healthCache}`);
}

const documentOnlyOnApi = [
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'content-security-policy-report-only',
  'permissions-policy',
];

for (const name of documentOnlyOnApi) {
  const got = healthHeaders.get(name);

  if (got) {
    fail(`/api/health unexpected document header ${name}: ${got}`);
  } else {
    pass(`/api/health has no ${name}`);
  }
}

const healthCors = healthHeaders.get('access-control-allow-origin');

if (healthCors) {
  fail(`/api/health Access-Control-Allow-Origin is ${healthCors}`);
} else {
  pass('/api/health has no Access-Control-Allow-Origin');
}

for (const { path, text } of bodies) {
  assertKeys(path, text);
}

if (failed) {
  console.error(`\n${failed} check(s) failed against ${origin}`);
  process.exit(1);
}

console.log(`\nall checks passed against ${origin}`);
