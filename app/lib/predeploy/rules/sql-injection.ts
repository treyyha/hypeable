/**
 * WARN: SQL built from `${}` interpolation or string concatenation. Heuristic.
 *
 * Tagged templates (`sql\`...\``, Prisma `$queryRaw\`...\``) parameterise their
 * holes and are skipped. Checks are plain string tests, not one big regex, so a
 * long minified line cannot backtrack.
 */

import { eachLine, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const SQL_START = /\b(?:select\s[\s\S]{0,200}?\sfrom|insert\s+into|update\s+[\w."]+\s+set|delete\s+from)\b/i;
const CONCAT = /['"]\s*\+\s*[A-Za-z_$]|[A-Za-z_$)\]]\s*\+\s*['"]/;
const TAGGED_TEMPLATE = /(?:\bsql|\$queryRaw|\$executeRaw)\s*`/;
const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|rb|php|go)$/i;

function interpolatedSql(text: string): boolean {
  if (!SQL_START.test(text)) {
    return false;
  }

  if (text.includes('`') && text.includes('${')) {
    return !TAGGED_TEMPLATE.test(text);
  }

  return CONCAT.test(text);
}

export const sqlInjectionRule: PredeployRule = {
  id: 'sql-injection',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    eachLine(files, (file, line, text) => {
      if (!CODE_FILE.test(file) || !interpolatedSql(text)) {
        return;
      }

      findings.push(
        makeFinding(sqlInjectionRule, {
          file,
          line,
          maskedSnippet: text.trim().slice(0, 160),
          why: 'SQL is built by pasting values into the query string, so input can change the query.',
          fix: 'Use parameters ($1 / ?) or a tagged sql`` template, never string building.',
        }),
      );
    });

    return findings;
  },
};
