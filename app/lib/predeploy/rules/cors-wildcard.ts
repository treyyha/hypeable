/**
 * WARN: Access-Control-Allow-Origin * (worse with credentials). Heuristic.
 */

import { eachLine, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const ORIGIN_STAR = /access-control-allow-origin['"\s:=,]*\*/i;
const CREDENTIALS = /access-control-allow-credentials['"\s:=,]*true/i;

export const corsWildcardRule: PredeployRule = {
  id: 'cors-wildcard',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    for (const [file, content] of Object.entries(files)) {
      const hasCredentials = CREDENTIALS.test(content);

      eachLine({ [file]: content }, (path, line, text) => {
        if (!ORIGIN_STAR.test(text) && !/allow[-]?origin[^\n]*\*/i.test(text) && !/origin:\s*['"]\*/i.test(text)) {
          return;
        }

        findings.push(
          makeFinding(corsWildcardRule, {
            file: path,
            line,
            maskedSnippet: text.trim().slice(0, 160),
            why: hasCredentials
              ? 'Wildcard CORS plus credentials lets any site call this API as the user.'
              : 'Wildcard CORS lets any origin read responses from this API.',
            fix: 'List explicit origins instead of `*`. Never combine `*` with credentials.',
          }),
        );
      });
    }

    return findings;
  },
};
