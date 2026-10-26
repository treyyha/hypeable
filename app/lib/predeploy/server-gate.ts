/**
 * Server-side pre-deploy gate. Deploy APIs re-scan the uploaded files so a
 * direct POST cannot skip the check the UI modal runs.
 */

import { publishActionEnabled } from './gating';
import { scan } from './scan';
import type { ScanOutcome } from './types';

export type PredeployGateResult =
  { ok: true; outcome: ScanOutcome } | { ok: false; status: 403; message: string; outcome: ScanOutcome };

export function assertPredeployClearance(
  files: Record<string, string>,
  acknowledgedRisk: boolean,
): PredeployGateResult {
  const report = scan(files);

  if (!publishActionEnabled(report.outcome, acknowledgedRisk)) {
    return {
      ok: false,
      status: 403,
      message: 'Pre-deploy check found issues that must be acknowledged before publish.',
      outcome: report.outcome,
    };
  }

  return { ok: true, outcome: report.outcome };
}

export function predeployBlockedResponse(result: Extract<PredeployGateResult, { ok: false }>): Response {
  return Response.json(
    {
      error: result.message,
      outcome: result.outcome,
    },
    { status: result.status },
  );
}
