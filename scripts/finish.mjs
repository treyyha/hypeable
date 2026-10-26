#!/usr/bin/env node
// Pull --rebase, push, then watch the CI run for this SHA once.
import { execFileSync, spawnSync } from 'node:child_process';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', ...opts });
const out = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const die = (message) => {
  console.error('❌ ' + message);
  process.exit(1);
};

function sleep(ms) {
  spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`]);
}

if (!out('rev-parse', '--is-inside-work-tree')) {
  die('not a git repo');
}

const branch = out('rev-parse', '--abbrev-ref', 'HEAD');

if (branch === 'HEAD') {
  die('detached HEAD. Check out a branch first.');
}

const hasRemote = out('remote').split('\n').includes('origin');

if (!hasRemote) {
  die('no "origin" remote. Add one, then re-run npm run finish.');
}

function originRepo() {
  const url = out('remote', 'get-url', 'origin').replace(/\.git$/, '');
  const match = url.match(/github\.com[:/]([^/]+\/[^/]+)$/i);

  if (!match) {
    die('origin is not a GitHub remote');
  }

  return match[1];
}

const repo = originRepo();

if (run('git', ['pull', '--rebase', '--autostash']).status !== 0) {
  die('rebase conflict. Resolve it, then: git rebase --continue && npm run finish');
}

const hasUpstream = spawnSync('git', ['rev-parse', '--abbrev-ref', '@{u}'], { stdio: 'ignore' }).status === 0;
const push = hasUpstream ? run('git', ['push']) : run('git', ['push', '-u', 'origin', branch]);

if (push.status !== 0) {
  die('push failed. Check GitHub auth / branch protection.');
}

const sha = out('rev-parse', 'HEAD');
console.log(`▶ watching CI for ${sha.slice(0, 7)} (once)`);

let runId = '';

for (let attempt = 0; attempt < 24; attempt += 1) {
  const listed = execFileSync(
    'gh',
    ['run', 'list', '--repo', repo, '--workflow', 'CI', '--limit', '10', '--json', 'databaseId,headSha,status,url'],
    { encoding: 'utf8' },
  );

  const match = JSON.parse(listed).find((item) => item.headSha === sha);

  if (match) {
    runId = String(match.databaseId);
    console.log(match.url);
    break;
  }

  sleep(5000);
}

if (!runId) {
  die('no CI run appeared for this commit. Check GitHub Actions.');
}

const watch = run('gh', ['run', 'watch', runId, '--repo', repo, '--exit-status']);

if (watch.status !== 0) {
  die('CI red. Fix it before anything else, then npm run finish.');
}

console.log('✅ CI green');
