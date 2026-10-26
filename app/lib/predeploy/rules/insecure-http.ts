/**
 * WARN: http:// API URLs (not localhost).
 */

import { eachLine, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const HTTP_URL =
  /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|www\.w3\.org|schemas\.xmlsoap\.org)[^'"`\s]+['"`]/i;

export const insecureHttpRule: PredeployRule = {
  id: 'insecure-http',
  severity: 'WARN',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];

    eachLine(files, (file, line, text) => {
      const match = text.match(HTTP_URL);

      if (!match) {
        return;
      }

      findings.push(
        makeFinding(insecureHttpRule, {
          file,
          line,
          maskedSnippet: match[0].slice(0, 160),
          why: 'An http:// API URL sends traffic (and cookies) in the clear.',
          fix: 'Use https://. Localhost http is fine for development only.',
        }),
      );
    });

    return findings;
  },
};
