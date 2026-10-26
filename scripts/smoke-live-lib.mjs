/**
 * Arg parsing and commit matching for scripts/smoke-live.mjs.
 */

export function parseSmokeLiveArgs(argv) {
  let url = '';
  let expectCommit = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--expect-commit' || arg.startsWith('--expect-commit=')) {
      if (arg.startsWith('--expect-commit=') && arg.length > '--expect-commit='.length) {
        expectCommit = arg.slice('--expect-commit='.length).trim();
      } else {
        expectCommit = String(argv[i + 1] ?? '').trim();
        i += 1;
      }

      continue;
    }

    if (arg.startsWith('-')) {
      continue;
    }

    if (!url) {
      url = arg;
    }
  }

  return { url, expectCommit };
}

export function commitsMatch(deployed, expected) {
  if (!deployed || !expected) {
    return false;
  }

  const a = String(deployed).trim().toLowerCase();
  const b = String(expected).trim().toLowerCase();

  return a === b || a.startsWith(b) || b.startsWith(a);
}

export async function waitForCommit({
  origin,
  expected,
  timeoutMs = 5 * 60 * 1000,
  intervalMs = 5000,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
}) {
  const deadline = now() + timeoutMs;

  let last = 'none';

  while (now() <= deadline) {
    try {
      const response = await fetchImpl(origin + '/api/health', { redirect: 'manual' });
      const body = await response.json();
      last = body?.commit ?? `status ${response.status}`;

      if (body?.ok === true && commitsMatch(body.commit, expected)) {
        log(`ok    deployed commit ${body.commit} matches ${expected}`);
        return body.commit;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }

    if (now() + intervalMs > deadline) {
      break;
    }

    await sleep(intervalMs);
  }

  throw new Error(`deployed commit did not match ${expected} within ${timeoutMs}ms (last: ${last})`);
}
