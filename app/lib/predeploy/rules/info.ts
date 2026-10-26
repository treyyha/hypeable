/**
 * INFO: missing security headers, missing .gitignore.
 */

import { makeFinding } from '~/lib/predeploy/helpers';
import type { PredeployRule } from '~/lib/predeploy/types';

const HEADER_NAMES =
  /content-security-policy|x-frame-options|strict-transport-security|x-content-type-options|helmet\s*\(/i;

function hasSecurityHeaders(files: Record<string, string>): boolean {
  for (const [file, content] of Object.entries(files)) {
    const base = file.replace(/\\/g, '/').split('/').pop() ?? file;

    if (
      base === 'vercel.json' ||
      base === 'netlify.toml' ||
      base === '_headers' ||
      /next\.config\.(js|mjs|ts)$/i.test(base) ||
      /firebase\.json$/i.test(base)
    ) {
      if (HEADER_NAMES.test(content) || /"headers"\s*:/.test(content)) {
        return true;
      }
    }

    if (HEADER_NAMES.test(content) && /headers\s*:/.test(content)) {
      return true;
    }
  }

  return false;
}

export const missingSecurityHeadersRule: PredeployRule = {
  id: 'missing-security-headers',
  severity: 'INFO',
  heuristic: true,
  run(files) {
    if (hasSecurityHeaders(files)) {
      return [];
    }

    return [
      makeFinding(missingSecurityHeadersRule, {
        file: 'vercel.json',
        line: 1,
        maskedSnippet: '(no security headers found)',
        why: 'No CSP / X-Frame-Options / HSTS configuration was found.',
        fix: 'Add security headers in vercel.json, netlify _headers, or your framework config.',
      }),
    ];
  },
};

export const missingGitignoreRule: PredeployRule = {
  id: 'missing-gitignore',
  severity: 'INFO',
  heuristic: false,
  run(files) {
    if (Object.keys(files).some((file) => file.replace(/\\/g, '/').split('/').pop() === '.gitignore')) {
      return [];
    }

    return [
      makeFinding(missingGitignoreRule, {
        file: '.gitignore',
        line: 1,
        maskedSnippet: '(no .gitignore)',
        why: 'There is no .gitignore, so .env, node_modules, and keys can be committed.',
        fix: 'Add a .gitignore that includes `.env`, `node_modules`, and `dist`.',
      }),
    ];
  },
};
