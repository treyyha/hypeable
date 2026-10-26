/**
 * FAIL: service_role / secret-named public env vars in client code.
 */

import { eachLine, isClientPath, makeFinding } from '~/lib/predeploy/helpers';
import { maskSnippet } from '~/lib/predeploy/mask';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const SERVICE_ROLE = /service_role|SERVICE_ROLE|supabase.*secret/i;

const PUBLIC_SECRET_ENV =
  /\b(?:VITE_|NEXT_PUBLIC_|PUBLIC_)[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|SECRET_KEY|SERVICE_KEY)[A-Z0-9_]*\b/;

export const clientSecretRule: PredeployRule = {
  id: 'client-secret',
  severity: 'FAIL',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];

    eachLine(files, (file, line, text, content) => {
      if (!isClientPath(file, content) && !PUBLIC_SECRET_ENV.test(text) && !/\.env/.test(file)) {
        return;
      }

      PUBLIC_SECRET_ENV.lastIndex = 0;

      const envMatch = text.match(PUBLIC_SECRET_ENV);

      if (envMatch) {
        findings.push(
          makeFinding(clientSecretRule, {
            file,
            line,
            maskedSnippet: maskSnippet(text, envMatch),
            why: 'A public env prefix would ship this secret-named key to the browser.',
            fix: 'Rename to a server-only env var (no VITE_ / NEXT_PUBLIC_ / PUBLIC_ prefix).',
          }),
        );
      }

      if (isClientPath(file, content) && SERVICE_ROLE.test(text)) {
        findings.push(
          makeFinding(clientSecretRule, {
            file,
            line,
            maskedSnippet: maskSnippet(text, text.match(SERVICE_ROLE) ?? ['service_role']),
            why: 'A service_role / secret key in client code is fully public.',
            fix: 'Keep service_role keys on the server and use the anon key plus RLS in the browser.',
          }),
        );
      }
    });

    return findings;
  },
};
