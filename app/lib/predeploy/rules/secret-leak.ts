/**
 * FAIL: known secret/key patterns in any file.
 */

import { eachLine, makeFinding } from '~/lib/predeploy/helpers';
import { maskSnippet } from '~/lib/predeploy/mask';
import { cloneSecretPatterns } from '~/lib/predeploy/patterns';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

export const secretLeakRule: PredeployRule = {
  id: 'secret-leak',
  severity: 'FAIL',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];
    const patterns = cloneSecretPatterns();

    eachLine(files, (file, line, text) => {
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;

        const matches = text.match(pattern.regex);

        if (!matches) {
          continue;
        }

        findings.push(
          makeFinding(secretLeakRule, {
            file,
            line,
            maskedSnippet: maskSnippet(text, matches),
            why: `Looks like a ${pattern.label}.`,
            fix: 'Move the value to a server-only env var and rotate it if it was ever real.',
          }),
        );
      }
    });

    return findings;
  },
};
