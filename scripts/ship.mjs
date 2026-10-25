#!/usr/bin/env node
/*
 * Secret-scan, then commit locally. Hooks also scan and lint staged files.
 * Typecheck runs on push (pre-push + `npm run finish`). Never force-pushes.
 *   npm run ship                       auto-generates a conventional commit message
 *   npm run ship -- "feat(meter): live cost meter"
 *   npm run ship -- "feat(hooks): cut commit time (windows)"
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseShipArgs } from './ship-lib.mjs';

const { message: userMsg } = parseShipArgs(process.argv.slice(2));
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', ...opts });
const out = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const die = (message) => {
  console.error('❌ ' + message);
  process.exit(1);
};

if (!existsSync('.git')) {
  die('not a git repo. Run: git init');
}

const branch = out('rev-parse', '--abbrev-ref', 'HEAD');

if (branch === 'HEAD') {
  die('detached HEAD. Check out a branch first.');
}

if (!out('status', '--porcelain')) {
  console.log('Nothing to ship, working tree clean.');
  process.exit(0);
}

const alreadyStaged = Boolean(out('diff', '--cached', '--name-only'));

if (!alreadyStaged) {
  run('git', ['add', '-A']);
}

if (run('node', ['scripts/secret-scan.mjs']).status !== 0) {
  if (!alreadyStaged) {
    run('git', ['reset', '-q']);
  }

  die('secrets found, nothing committed.');
}

function autoMessage() {
  const files = out('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const has = (re) => files.some((file) => re.test(file));
  const only = (re) => files.every((file) => re.test(file));

  let type = 'chore';

  if (only(/\.(md|mdx)$|^docs\//)) {
    type = 'docs';
  } else if (only(/(^|\/)(test|tests|__tests__)\/|\.(test|spec)\./)) {
    type = 'test';
  } else if (only(/^\.github\//)) {
    type = 'ci';
  } else if (has(/^(app|src|packages)\//)) {
    type = 'feat';
  }

  const dirs = [
    ...new Set(files.filter((file) => file.includes('/')).map((file) => file.split('/')[0].replace(/^\./, ''))),
  ].slice(0, 3);
  const scope =
    dirs.length === 1 && files.every((file) => file.includes('/'))
      ? `(${dirs[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'repo'})`
      : '';

  const stat = out('diff', '--cached', '--shortstat');

  return `${type}${scope}: update ${files.length} file${files.length === 1 ? '' : 's'}\n\n${files
    .slice(0, 15)
    .map((file) => '- ' + file)
    .join('\n')}${files.length > 15 ? `\n- ...and ${files.length - 15} more` : ''}\n\n${stat}`;
}

const msg = userMsg || autoMessage();

if (run('git', ['commit', '-m', msg]).status !== 0) {
  die('commit failed (hook rejected it?). Fix and re-run.');
}

console.log('✅ committed locally on ' + branch + '. Push and watch CI with: npm run finish');
