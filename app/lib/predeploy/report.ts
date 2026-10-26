/**
 * Markdown report for copy/paste. Masked findings only.
 */

import type { Finding, ScanReport } from './types';

function findingBlock(finding: Finding): string {
  const flags = [
    finding.heuristic ? 'heuristic, verify' : null,
    finding.suppressed ? `suppressed (${finding.ignoreReason ?? ''})` : null,
  ]
    .filter(Boolean)
    .join('; ');

  return [
    `- \`${finding.file}:${finding.line}\` **${finding.ruleId}** (${finding.severity}${flags ? `; ${flags}` : ''})`,
    `  ${finding.why}`,
    `  \`${finding.maskedSnippet}\``,
    `  Fix: ${finding.fix}`,
  ].join('\n');
}

export function reportToMarkdown(report: ScanReport): string {
  const lines = [
    `# Pre-deploy check`,
    ``,
    `Outcome: **${report.outcome.toUpperCase()}** · ${report.counts.fail} fail · ${report.counts.warn} warn · ${report.counts.info} info · ${report.counts.suppressed} suppressed`,
    ``,
  ];

  const groups: Array<Finding['severity'] | 'suppressed'> = ['FAIL', 'WARN', 'INFO'];

  for (const group of groups) {
    const rows = report.findings.filter((finding) => !finding.suppressed && finding.severity === group);

    if (rows.length === 0) {
      continue;
    }

    lines.push(`## ${group}`);
    lines.push('');

    for (const finding of rows) {
      lines.push(findingBlock(finding));
    }

    lines.push('');
  }

  const suppressed = report.findings.filter((finding) => finding.suppressed);

  if (suppressed.length > 0) {
    lines.push('## Suppressed');
    lines.push('');

    for (const finding of suppressed) {
      lines.push(findingBlock(finding));
    }
  }

  return lines.join('\n').trim() + '\n';
}

export function fixWithAiPrompt(report: ScanReport): string {
  const active = report.findings.filter((finding) => !finding.suppressed);

  return [
    'Fix these pre-deploy security findings in the current project. Do not repeat any secret values; they are masked. After each fix, explain what changed.',
    '',
    reportToMarkdown({ ...report, findings: active, counts: { ...report.counts, suppressed: 0 } }),
  ].join('\n');
}
