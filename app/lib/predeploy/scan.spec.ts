import { describe, expect, it } from 'vitest';
import { cleanFixture, ignoreCommentFixture, jwtLeakFixture, RULE_FIXTURES, secretLeakFixture } from './fixtures';
import { findingHoldsSecret } from './mask';
import { PREDEPLOY_RULES } from './registry';
import { scan } from './scan';

function fakeAnt(): string {
  return `sk-ant-${'a'.repeat(24)}`;
}

function fakeJwt(): string {
  return `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(16)}`;
}

describe('predeploy scan', () => {
  it('produces zero findings on the clean fixture', () => {
    const report = scan(cleanFixture);
    expect(report.findings.filter((finding) => !finding.suppressed)).toEqual([]);
    expect(report.outcome).toBe('pass');
    expect(report.counts).toMatchObject({ fail: 0, warn: 0, info: 0 });
  });

  it('fires the matching rule on each vulnerable fixture', () => {
    const missing = PREDEPLOY_RULES.map((rule) => rule.id).filter((id) => {
      const files = RULE_FIXTURES[id];
      return !files || !scan(files).findings.some((finding) => finding.ruleId === id && !finding.suppressed);
    });

    expect(missing).toEqual([]);
  });

  it('never stores a full secret on a finding, including JWT and API keys', () => {
    const secret = fakeAnt();
    const jwt = fakeJwt();
    const leaked = scan(secretLeakFixture);
    const jwtReport = scan(jwtLeakFixture);

    for (const finding of [...leaked.findings, ...jwtReport.findings]) {
      expect(findingHoldsSecret(finding, secret), `${finding.ruleId} leaked API key`).toBe(false);
      expect(findingHoldsSecret(finding, jwt), `${finding.ruleId} leaked JWT`).toBe(false);
      expect(finding.maskedSnippet.includes('***') || finding.severity === 'INFO').toBe(true);
    }

    expect(JSON.stringify(leaked)).not.toContain(secret);
    expect(JSON.stringify(jwtReport)).not.toContain(jwt);
  });

  it('marks ignored findings as suppressed and does not fail the scan', () => {
    const report = scan(ignoreCommentFixture);
    const ignored = report.findings.filter((finding) => finding.ruleId === 'secret-leak');

    expect(ignored.length).toBeGreaterThan(0);
    expect(ignored.every((finding) => finding.suppressed)).toBe(true);
    expect(report.outcome).not.toBe('fail');
    expect(report.counts.suppressed).toBeGreaterThan(0);
  });

  it('skips lockfiles, node_modules, and files over 1MB', () => {
    const report = scan({
      ...cleanFixture,
      'node_modules/evil/index.js': `export const key = "${fakeAnt()}";`,
      'package-lock.json': `{"key":"${fakeAnt()}"}`,
      'huge.txt': `${'a'.repeat(1_000_001)}sk-ant-${'b'.repeat(24)}`,
    });

    expect(report.findings.some((finding) => finding.file.includes('node_modules'))).toBe(false);
    expect(report.findings.some((finding) => finding.file === 'package-lock.json')).toBe(false);
    expect(report.findings.some((finding) => finding.file === 'huge.txt')).toBe(false);
    expect(report.skippedCount).toBeGreaterThanOrEqual(3);
  });
});
