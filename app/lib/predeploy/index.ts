/**
 * Pre-deploy security check: scan generated app files in the browser before publish.
 */

export { scan } from './scan';
export { collectScanFiles, filterScanFiles, fingerprintFiles, shouldSkipScanPath } from './collect';
export { maskSecret, maskSnippet, findingHoldsSecret } from './mask';
export { reportToMarkdown, fixWithAiPrompt } from './report';
export { PREDEPLOY_RULES, ruleById } from './registry';
export { withPredeployScan, withPredeployScanFiles } from './intercept';
export { applyIgnores, parseIgnores } from './ignore';
export type { Finding, ScanReport, ScanOutcome, Severity, PredeployRule } from './types';
