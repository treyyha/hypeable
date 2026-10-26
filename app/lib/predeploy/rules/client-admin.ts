/**
 * WARN: client-side-only admin checks. Heuristic.
 */

import { eachLine, isClientPath, makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const ADMIN_FROM_STORAGE = /(isAdmin|is_admin|role)\s*=\s*.*(localStorage|sessionStorage)/i;

const STORAGE_ADMIN = /(localStorage|sessionStorage)\.getItem\(\s*['"](isAdmin|role|admin)['"]/i;
const STATE_ADMIN = /useState\([^)]*(admin|isAdmin)/i;

export const clientAdminCheckRule: PredeployRule = {
  id: 'client-admin-check',
  severity: 'WARN',
  heuristic: true,
  run(files) {
    const findings: Finding[] = [];

    eachLine(files, (file, line, text, content) => {
      if (!isClientPath(file, content) && !/\.(tsx|jsx)$/i.test(file)) {
        return;
      }

      if (!ADMIN_FROM_STORAGE.test(text) && !STORAGE_ADMIN.test(text) && !STATE_ADMIN.test(text)) {
        return;
      }

      findings.push(
        makeFinding(clientAdminCheckRule, {
          file,
          line,
          maskedSnippet: text.trim().slice(0, 160),
          why: 'Admin is decided in the browser. Anyone can flip localStorage and call your APIs.',
          fix: 'Enforce admin on the server from the session. UI hiding is not security.',
        }),
      );
    });

    return findings;
  },
};
