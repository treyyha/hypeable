/**
 * Run every pre-deploy rule locally. No network.
 */

import { filterScanFiles } from './collect';
import { SEVERITY_ORDER } from './helpers';
import { applyIgnores } from './ignore';
import { PREDEPLOY_RULES } from './registry';
import type { Finding, ScanOutcome, ScanReport } from './types';

function outcomeOf(findings: Finding[]): ScanOutcome {
  if (findings.some((finding) => !finding.suppressed && finding.severity === 'FAIL')) {
    return 'fail';
  }

  if (findings.some((finding) => !finding.suppressed && finding.severity === 'WARN')) {
    return 'warn';
  }

  return 'pass';
}

function countsOf(findings: Finding[]) {
  const counts = { fail: 0, warn: 0, info: 0, suppressed: 0 };

  for (const finding of findings) {
    if (finding.suppressed) {
      counts.suppressed += 1;
      continue;
    }

    if (finding.severity === 'FAIL') {
      counts.fail += 1;
    } else if (finding.severity === 'WARN') {
      counts.warn += 1;
    } else {
      counts.info += 1;
    }
  }

  return counts;
}

export function scan(files: Record<string, string>): ScanReport {
  const started =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

  const { kept, skipped } = filterScanFiles(files);
  const raw: Finding[] = [];

  for (const rule of PREDEPLOY_RULES) {
    raw.push(...rule.run(kept));
  }

  const findings = applyIgnores(kept, raw).sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

    if (severity !== 0) {
      return severity;
    }

    return a.file.localeCompare(b.file) || a.line - b.line || a.ruleId.localeCompare(b.ruleId);
  });

  const ended =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

  const durationMs = ended - started;

  if (import.meta.env?.DEV) {
    console.info(`[predeploy] scanned ${Object.keys(kept).length} files in ${durationMs.toFixed(1)}ms`);
  }

  return {
    findings,
    counts: countsOf(findings),
    outcome: outcomeOf(findings),
    fileCount: Object.keys(kept).length,
    skippedCount: skipped,
    durationMs,
  };
}
