/**
 * Inline suppressions: `hypeable-ignore: RULE_ID reason`
 */

import type { Finding } from './types';

const IGNORE_RE = /hypeable-ignore:\s*([A-Za-z0-9_-]+)\s+(\S.*)$/;

export type IgnoreHit = {
  ruleId: string;
  reason: string;
  line: number;
};

export function parseIgnores(content: string): IgnoreHit[] {
  const hits: IgnoreHit[] = [];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const match = IGNORE_RE.exec(lines[index] ?? '');

    if (!match) {
      continue;
    }

    hits.push({
      ruleId: match[1],
      reason: match[2].trim(),
      line: index + 1,
    });
  }

  return hits;
}

export function applyIgnores(files: Record<string, string>, findings: Finding[]): Finding[] {
  const byFile = new Map<string, IgnoreHit[]>();

  for (const [file, content] of Object.entries(files)) {
    byFile.set(file, parseIgnores(content));
  }

  return findings.map((finding) => {
    const ignores = byFile.get(finding.file) ?? [];

    const hit = ignores.find(
      (ignore) =>
        ignore.ruleId === finding.ruleId && (ignore.line === finding.line || ignore.line === finding.line - 1),
    );

    if (!hit) {
      return finding;
    }

    return { ...finding, suppressed: true, ignoreReason: hit.reason };
  });
}
