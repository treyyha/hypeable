/**
 * WARN: dependency versions set to * or latest.
 */

import { makeFinding } from '~/lib/predeploy/helpers';
import type { Finding, PredeployRule } from '~/lib/predeploy/types';

function unpinned(version: unknown): boolean {
  if (typeof version !== 'string') {
    return false;
  }

  const trimmed = version.trim().toLowerCase();

  return trimmed === '*' || trimmed === 'latest' || trimmed.startsWith('latest');
}

export const unpinnedDependencyRule: PredeployRule = {
  id: 'unpinned-dependency',
  severity: 'WARN',
  heuristic: false,
  run(files) {
    const findings: Finding[] = [];
    const raw = files['package.json'];

    if (!raw) {
      return findings;
    }

    try {
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const groups = [pkg.dependencies, pkg.devDependencies];

      for (const group of groups) {
        if (!group) {
          continue;
        }

        for (const [name, version] of Object.entries(group)) {
          if (!unpinned(version)) {
            continue;
          }

          const line =
            raw.split('\n').findIndex((row) => row.includes(`"${name}"`) && row.includes(String(version))) + 1;
          findings.push(
            makeFinding(unpinnedDependencyRule, {
              file: 'package.json',
              line: line > 0 ? line : 1,
              maskedSnippet: `"${name}": "${version}"`,
              why: `${name} uses an unpinned range (${version}), so builds are not reproducible.`,
              fix: 'Pin an exact version or a caret range you have tested, not * or latest.',
            }),
          );
        }
      }
    } catch {
      return findings;
    }

    return findings;
  },
};
