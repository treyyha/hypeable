/**
 * FAIL: Firebase/Firestore/RTDB rules that allow anyone to read and write.
 */

import { linesOf, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const OPEN_ALLOW = /allow\s+read\s*,\s*write\s*:\s*if\s+true/i;
const OPEN_READ = /["']\.read["']\s*:\s*true/;
const OPEN_WRITE = /["']\.write["']\s*:\s*true/;

function isRulesFile(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.endsWith('.rules') ||
    normalized.endsWith('firebase.json') ||
    normalized.includes('firestore.rules') ||
    normalized.includes('database.rules') ||
    normalized.includes('storage.rules')
  );
}

export const firebaseOpenRulesRule: PredeployRule = {
  id: 'firebase-open-rules',
  severity: 'FAIL',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];

    for (const [file, content] of Object.entries(files)) {
      if (!isRulesFile(file) && !OPEN_ALLOW.test(content) && !OPEN_READ.test(content)) {
        continue;
      }

      const lines = linesOf(content);

      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index] ?? '';

        if (OPEN_ALLOW.test(text) || OPEN_READ.test(text) || OPEN_WRITE.test(text)) {
          findings.push(
            makeFinding(firebaseOpenRulesRule, {
              file,
              line: index + 1,
              maskedSnippet: text.trim().slice(0, 160),
              why: 'Firebase rules allow anyone to read or write.',
              fix: 'Replace `if true` / `".read": true` with auth checks (`request.auth != null`) and lock down writes.',
            }),
          );
        }
      }
    }

    return findings;
  },
};
