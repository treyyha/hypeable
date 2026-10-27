#!/usr/bin/env node
/*
 * Keep a single GitHub issue titled "Site down".
 *   node scripts/uptime-issue.mjs down   # open or update, never a second open issue
 *   node scripts/uptime-issue.mjs up     # close it when smoke:live is green
 */
const TITLE = 'Site down';
const LABEL = 'site-down';
const MODE = process.argv[2];

if (MODE !== 'down' && MODE !== 'up') {
  console.error('usage: node scripts/uptime-issue.mjs down|up');
  process.exit(1);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;

if (!token || !repo) {
  console.error('GH_TOKEN (or GITHUB_TOKEN) and GITHUB_REPOSITORY are required');
  process.exit(1);
}

const api = `https://api.github.com/repos/${repo}`;

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'hypeable-uptime',
};

async function github(method, path, body) {
  const response = await fetch(api + path, {
    method,
    headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  if (!response.ok) {
    const message = json && typeof json.message === 'string' ? json.message : text.slice(0, 200);
    throw new Error(`${method} ${path} → ${response.status} ${message}`);
  }

  return json;
}

await github('POST', '/labels', {
  name: LABEL,
  color: 'b60205',
  description: 'Production https://hypeable.dev failed smoke:live',
}).catch((error) => {
  if (!String(error.message).includes('already_exists') && !String(error.message).includes('422')) {
    throw error;
  }
});

const open = await github('GET', `/issues?state=open&labels=${encodeURIComponent(LABEL)}&per_page=20`);
const matches = (Array.isArray(open) ? open : []).filter((issue) => issue.title === TITLE && !issue.pull_request);
matches.sort((a, b) => a.number - b.number);

const existing = matches[0];

const when = new Date().toISOString();

const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '';

if (MODE === 'down') {
  const body = [
    'https://hypeable.dev failed `npm run smoke:live`.',
    '',
    `Last checked: ${when}`,
    runUrl ? `Workflow run: ${runUrl}` : '',
    '',
    'This issue is unique. The uptime workflow updates this body instead of opening duplicates, and closes it when the next run is green.',
  ]
    .filter(Boolean)
    .join('\n');

  if (existing) {
    await github('PATCH', `/issues/${existing.number}`, { body });
    console.log(`updated #${existing.number}`);
    process.exit(0);
  }

  const created = await github('POST', '/issues', {
    title: TITLE,
    labels: [LABEL],
    body,
  });
  console.log(`opened #${created.number}`);
  process.exit(0);
}

if (!existing) {
  console.log('no open Site down issue');
  process.exit(0);
}

await github('POST', `/issues/${existing.number}/comments`, {
  body: `Recovered at ${when}. ${runUrl}`.trim(),
});
await github('PATCH', `/issues/${existing.number}`, { state: 'closed', state_reason: 'completed' });
console.log(`closed #${existing.number}`);
