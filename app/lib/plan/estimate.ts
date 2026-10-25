/**
 * Honest dollar RANGE for a plan. Size-based token range × list price,
 * optionally calibrated from this browser's completed-build history.
 */
import type { HypeablePlan } from './schema';
import { cost, type CustomModelPrice } from '~/lib/cost/calc';
import type { MessageCostRecord } from '~/lib/cost/persist';

export type PlanCostEstimate = {
  low: number;
  high: number;
  planningCall: number;
  verified: boolean;
  unknown: boolean;
  source: 'table' | 'history' | 'blended' | 'unknown';
  label: 'estimate';
};

const PROMPT_BASE = 2_000;
const PROMPT_PER = 800;
const COMPLETION_LOW_BASE = 4_000;
const COMPLETION_LOW_PER = 1_500;
const COMPLETION_HIGH_BASE = 12_000;
const COMPLETION_HIGH_PER = 4_000;

export function planSize(plan: Pick<HypeablePlan, 'pages' | 'features'>): number {
  return Math.max(0, plan.pages.length) + Math.max(0, plan.features.length);
}

export function completedBuildCosts(history: readonly MessageCostRecord[]): number[] {
  return history
    .filter((entry) => !entry.pending && !entry.unknown && entry.dollars > 0)
    .map((entry) => entry.dollars)
    .sort((left, right) => left - right);
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));

  return sorted[idx] ?? 0;
}

export function estimatePlanCost(input: {
  model: string;
  provider?: string;
  customPrices?: Record<string, CustomModelPrice>;
  plan: Pick<HypeablePlan, 'pages' | 'features'>;
  history?: readonly MessageCostRecord[];
  planningCall?: { promptTokens: number; completionTokens: number };
}): PlanCostEstimate {
  const size = planSize(input.plan);
  const promptTokens = PROMPT_BASE + size * PROMPT_PER;
  const completionLow = COMPLETION_LOW_BASE + size * COMPLETION_LOW_PER;
  const completionHigh = COMPLETION_HIGH_BASE + size * COMPLETION_HIGH_PER;
  const options = { customPrices: input.customPrices, provider: input.provider };

  const lowResult = cost(input.model, promptTokens, completionLow, options);
  const highResult = cost(input.model, promptTokens, completionHigh, options);

  const planning = input.planningCall
    ? cost(input.model, input.planningCall.promptTokens, input.planningCall.completionTokens, options)
    : cost(input.model, Math.ceil(promptTokens / 4), Math.ceil(completionLow / 8), options);

  if (lowResult.unknown || highResult.unknown) {
    return {
      low: 0,
      high: 0,
      planningCall: planning.unknown ? 0 : planning.dollars,
      verified: false,
      unknown: true,
      source: 'unknown',
      label: 'estimate',
    };
  }

  let low = Math.min(lowResult.dollars, highResult.dollars);
  let high = Math.max(lowResult.dollars, highResult.dollars);
  let source: PlanCostEstimate['source'] = 'table';

  const verified = lowResult.verified !== false && highResult.verified !== false;

  const completed = completedBuildCosts(input.history ?? []);

  if (completed.length >= 2) {
    const q1 = percentile(completed, 0.25);
    const q3 = percentile(completed, 0.75);
    low = (low + Math.min(q1, q3)) / 2;
    high = (high + Math.max(q1, q3)) / 2;
    source = 'blended';
  }

  if (high < low) {
    const swap = low;
    low = high;
    high = swap;
  }

  return {
    low,
    high,
    planningCall: planning.unknown ? 0 : planning.dollars,
    verified,
    unknown: false,
    source,
    label: 'estimate',
  };
}
