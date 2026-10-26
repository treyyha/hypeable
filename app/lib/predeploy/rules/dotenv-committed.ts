/**
 * FAIL: .env with real values, or .env present while .gitignore does not ignore it.
 */

import { isDotEnv, isEnvExample, linesOf, makeFinding } from '~/lib/predeploy/helpers';
import { maskSnippet } from '~/lib/predeploy/mask';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

const PLACEHOLDER = /^(changeme|change-me|your-.*|xxx+|todo|replace.*|example.*|placeholder.*|<[^>]+>|""|'')$/i;

function gitignoreCoversEnv(gitignore: string | undefined): boolean {
  if (!gitignore) {
    return false;
  }

  return gitignore.split('\n').some((line) => {
    const trimmed = line.trim();
    return (
      trimmed === '.env' ||
      trimmed === '.env*' ||
      trimmed === '.env.*' ||
      trimmed === '*.env' ||
      trimmed === '.env.local'
    );
  });
}

function hasRealValue(content: string): { line: number; text: string; value: string } | null {
  const lines = linesOf(content);

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index] ?? '';
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(text);

    if (!match) {
      continue;
    }

    let value = match[2].trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!value || PLACEHOLDER.test(value)) {
      continue;
    }

    return { line: index + 1, text, value };
  }

  return null;
}

export const dotenvCommittedRule: PredeployRule = {
  id: 'dotenv-committed',
  severity: 'FAIL',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];
    const gitignore = files['.gitignore'];
    const covers = gitignoreCoversEnv(gitignore);

    for (const [file, content] of Object.entries(files)) {
      if (!isDotEnv(file) || isEnvExample(file)) {
        continue;
      }

      const real = hasRealValue(content);

      if (real) {
        findings.push(
          makeFinding(dotenvCommittedRule, {
            file,
            line: real.line,
            maskedSnippet: maskSnippet(real.text, [real.value]),
            why: 'A .env file with real values would be published with the app.',
            fix: 'Delete .env from the project, add it to .gitignore, and set values on the host.',
          }),
        );
      }

      if (!covers) {
        findings.push(
          makeFinding(dotenvCommittedRule, {
            file,
            line: 1,
            maskedSnippet: file,
            why: '.env is in the project and .gitignore does not ignore it.',
            fix: 'Add `.env` (and `.env.*`) to .gitignore so env files cannot be committed.',
          }),
        );
      }
    }

    return findings;
  },
};
