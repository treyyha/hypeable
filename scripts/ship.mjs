#!/usr/bin/env node
// One command: check -> secret scan -> commit -> push. Never force-pushes.
//   npm run ship                       auto-generates a conventional commit message
//   npm run ship -- "feat(meter): live cost meter"
//   npm run ship -- --no-verify-checks  skip lint/typecheck (secret scan ALWAYS runs)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const skipChecks = args.includes('--no-verify-checks');
const userMsg = args.find((a) => !a.startsWith('--'));
const NPM_CMDS = new Set(['npm', 'pnpm']);
// git/node: argv array, no shell, so spaces/quotes/parens in commit messages survive on Windows.
// npm/pnpm: shell required on Windows because they are .cmd shims, not executables.
const run = (cmd, a, opts = {}) =>
  spawnSync(cmd, a, { stdio: 'inherit', ...opts, shell: NPM_CMDS.has(cmd) });
const out = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const die = (m) => { console.error('❌ ' + m); process.exit(1); };

if (!existsSync('.git')) die('not a git repo. Run: git init');
const branch = out('rev-parse', '--abbrev-ref', 'HEAD');
if (branch === 'HEAD') die('detached HEAD. Check out a branch first.');

if (!out('status', '--porcelain')) { console.log('Nothing to ship, working tree clean.'); process.exit(0); }

run('git', ['add', '-A']);

// 1) secrets (always)
if (run('node', ['scripts/secret-scan.mjs']).status !== 0) { run('git', ['reset', '-q']); die('secrets found, nothing committed.'); }

// 2) checks (fast, only if the scripts exist)
if (!skipChecks && existsSync('package.json')) {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts || {};
  for (const s of ['typecheck', 'lint']) {
    if (scripts[s]) {
      console.log(`▶ npm run ${s}`);
      if (run('npm', ['run', s, '--silent']).status !== 0) { run('git', ['reset', '-q']); die(`${s} failed, nothing committed. Fix it (or --no-verify-checks).`); }
    }
  }
}

// 3) message
function autoMessage() {
  const files = out('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const has = (re) => files.some((f) => re.test(f));
  const only = (re) => files.every((f) => re.test(f));
  let type = 'chore';
  if (only(/\.(md|mdx)$|^docs\//)) type = 'docs';
  else if (only(/(^|\/)(test|tests|__tests__)\/|\.(test|spec)\./)) type = 'test';
  else if (only(/^\.github\//)) type = 'ci';
  else if (has(/^(app|src|packages)\//)) type = 'feat';
  const dirs = [...new Set(files.filter((f) => f.includes('/')).map((f) => f.split('/')[0].replace(/^\./, '')))].slice(0, 3);
  const scope = dirs.length === 1 && files.every((f) => f.includes('/')) ? `(${dirs[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'repo'})` : '';
  const stat = out('diff', '--cached', '--shortstat');
  return `${type}${scope}: update ${files.length} file${files.length === 1 ? '' : 's'}\n\n${files.slice(0, 15).map((f) => '- ' + f).join('\n')}${files.length > 15 ? `\n- ...and ${files.length - 15} more` : ''}\n\n${stat}`;
}
const msg = userMsg || autoMessage();
if (run('git', ['commit', '-m', msg]).status !== 0) die('commit failed (hook rejected it?). Fix and re-run.');

// 4) push, rebase first, never force
const hasRemote = out('remote').split('\n').includes('origin');
if (!hasRemote) { console.log('✅ committed locally. No "origin" remote yet, so nothing pushed.'); process.exit(0); }
const hasUpstream = spawnSync('git', ['rev-parse', '--abbrev-ref', '@{u}'], { stdio: 'ignore' }).status === 0;
if (hasUpstream && run('git', ['pull', '--rebase', '--autostash']).status !== 0) die('rebase conflict. Resolve it, then run: git rebase --continue && npm run ship');
const push = hasUpstream ? run('git', ['push']) : run('git', ['push', '-u', 'origin', branch]);
if (push.status !== 0) die('push failed. Check your GitHub auth / branch protection.');
console.log('✅ shipped to origin/' + branch);
