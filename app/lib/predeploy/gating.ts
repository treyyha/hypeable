/**
 * Modal continue rules: FAIL needs an explicit risk acknowledgement.
 */

import type { ScanOutcome } from './types';

export function publishActionEnabled(outcome: ScanOutcome, acknowledged: boolean): boolean {
  if (outcome === 'fail') {
    return acknowledged;
  }

  return true;
}

export function publishActionLabel(outcome: ScanOutcome): string {
  if (outcome === 'pass') {
    return 'Continue';
  }

  return 'Publish anyway';
}

export function showRiskCheckbox(outcome: ScanOutcome): boolean {
  return outcome === 'fail';
}

export function showPublishAnyway(outcome: ScanOutcome): boolean {
  return outcome !== 'pass';
}
