/**
 * Pre-deploy security scan types. Findings never carry a full secret.
 */

export type Severity = 'FAIL' | 'WARN' | 'INFO';

export type Finding = {
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  maskedSnippet: string;
  why: string;
  fix: string;
  heuristic: boolean;
  suppressed?: boolean;
  ignoreReason?: string;
};

export type ScanCounts = {
  fail: number;
  warn: number;
  info: number;
  suppressed: number;
};

export type ScanOutcome = 'pass' | 'warn' | 'fail';

export type ScanReport = {
  findings: Finding[];
  counts: ScanCounts;
  outcome: ScanOutcome;
  fileCount: number;
  skippedCount: number;
  durationMs: number;
};

export type PredeployRule = {
  id: string;
  severity: Severity;
  heuristic: boolean;
  run: (files: Record<string, string>) => Finding[];
};

export type ScanFileEntry = {
  type: 'file' | 'folder';
  content?: string;
  isBinary?: boolean;
};
