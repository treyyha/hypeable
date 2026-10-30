/**
 * WARN: dangerouslySetInnerHTML or eval with non-literal input. Heuristic.
 */

import { eachLine, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const DANGEROUS = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!['"`])/;
const EVAL_CALL = /\beval\s*\(\s*(?!['"`])/;

/** DOM sinks. A quoted literal is fine; a variable or `${}` template is not. */
const DOM_SINK =
  /(?:\.(?:inner|outer)HTML\s*\+?=(?!=)|\.insertAdjacentHTML\s*\(\s*['"][a-z]+['"]\s*,|\bdocument\.write(?:ln)?\s*\()\s*(.?)/i;

const INTERPOLATED_HTML = /(?:__html\s*:|(?:inner|outer)HTML\s*\+?=)\s*`[^`]*\$\{/;

function isDomSinkWithInput(text: string): boolean {
  const match = DOM_SINK.exec(text);

  if (!match) {
    return false;
  }

  const first = match[1];

  return first === '`'
    ? INTERPOLATED_HTML.test(text) || /`[^`]*\$\{/.test(text.slice(match.index))
    : !/['"]/.test(first);
}

export const unsafeHtmlRule: PredeployRule = {
  id: 'unsafe-html',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    eachLine(files, (file, line, text) => {
      if (DANGEROUS.test(text) || INTERPOLATED_HTML.test(text) || isDomSinkWithInput(text)) {
        findings.push(
          makeFinding(unsafeHtmlRule, {
            file,
            line,
            maskedSnippet: text.trim().slice(0, 160),
            why: 'Non-literal HTML injection can run attacker script.',
            fix: 'Render text as React children, or sanitize with a vetted library if HTML is required.',
          }),
        );
      }

      if (EVAL_CALL.test(text)) {
        findings.push(
          makeFinding(unsafeHtmlRule, {
            file,
            line,
            maskedSnippet: text.trim().slice(0, 160),
            why: 'eval() on non-literal input can execute attacker code.',
            fix: 'Remove eval. Parse JSON with JSON.parse, or use an explicit allow-listed function.',
          }),
        );
      }
    });

    return findings;
  },
};
