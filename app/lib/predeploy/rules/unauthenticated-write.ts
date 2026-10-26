/**
 * WARN: API/server handlers that write to a DB with no auth/session mention. Heuristic.
 */

import { isServerHandlerPath, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const WRITE_CALL =
  /\.(insert|update|upsert|delete|create|save|destroy)\s*\(|\.from\([^)]+\)\s*\.(insert|update|upsert|delete)/i;
const AUTH_HINT =
  /\b(getSession|getServerSession|getUser|requireAuth|requireUser|auth\(\)|cookies\(\)|authorization|session|currentUser|createServerClient)\b/i;

export const unauthenticatedWriteRule: PredeployRule = {
  id: 'unauthenticated-write',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    for (const [file, content] of Object.entries(files)) {
      if (!isServerHandlerPath(file)) {
        continue;
      }

      if (!WRITE_CALL.test(content) || AUTH_HINT.test(content)) {
        continue;
      }

      const match = WRITE_CALL.exec(content);
      const line = match ? content.slice(0, match.index).split('\n').length : 1;

      findings.push(
        makeFinding(unauthenticatedWriteRule, {
          file,
          line,
          maskedSnippet: (match?.[0] ?? file).slice(0, 160),
          why: 'This handler writes to a database and never mentions a session or auth check.',
          fix: 'Reject unauthenticated requests before any insert/update/delete.',
        }),
      );
    }

    return findings;
  },
};
