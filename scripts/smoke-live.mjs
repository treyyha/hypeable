#!/usr/bin/env node
/*
 * Live smoke against a deployed Hypeable. Exit 1 on any failure.
 *   npm run smoke:live -- https://hypeable.dev
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const target = process.argv[2];

if (!target) {
  console.error('usage: npm run smoke:live -- <url>');
  process.exit(2);
}

const origin = new URL(target).origin;

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

const health = await get('/api/health');

let healthJson;

try {
  healthJson = JSON.parse(health.text);
} catch {
  healthJson = null;
}

if (!healthJson || healthJson.ok !== true || healthJson.hosted !== true) {
  fail(`/api/health → ${health.text.slice(0, 160)}, expected {ok:true,hosted:true}`);
} else {
  pass('/api/health says hosted:true');
}

for (const { path, text } of bodies) {
  assertKeys(path, text);
}

if (failed) {
  console.error(`\n${failed} check(s) failed against ${origin}`);
  process.exit(1);
}

console.log(`\nall checks passed against ${origin}`);
