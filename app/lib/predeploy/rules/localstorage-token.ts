/**
 * WARN: auth tokens written to localStorage.
 */

import { eachLine, makeFinding } from '~/lib/predeploy/helpers';
import { maskSnippet } from '~/lib/predeploy/mask';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const SET_KEY = /localStorage\.setItem\(\s*['"][^'"]*(token|secret|jwt|passwd|password|api[_-]?key|auth)[^'"]*['"]/i;

const SET_VALUE = /localStorage\.setItem\(\s*['"][^'"]+['"]\s*,\s*(token|secret|jwt|password|apiKey|accessToken)/i;

export const localStorageTokenRule: PredeployRule = {
  id: 'localstorage-token',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    eachLine(files, (file, line, text) => {
      if (!SET_KEY.test(text) && !SET_VALUE.test(text)) {
        return;
      }

      findings.push(
        makeFinding(localStorageTokenRule, {
          file,
          line,
          maskedSnippet: maskSnippet(text, text.match(/['"][^'"]{8,}['"]/g) ?? []),
          why: 'Tokens in localStorage are readable by any script on this origin (XSS).',
          fix: 'Keep session tokens in an HttpOnly cookie, or in memory, not localStorage.',
        }),
      );
    });

    return findings;
  },
};
