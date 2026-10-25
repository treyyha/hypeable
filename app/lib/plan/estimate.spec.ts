import { describe, expect, it } from 'vitest';
import { estimatePlanCost } from './estimate';
import { cost } from '~/lib/cost/calc';
import type { MessageCostRecord } from '~/lib/cost/persist';

const smallPlan = {
  pages: [{ name: 'Home', purpose: 'List' }],
  features: [{ id: 'list', text: 'List notes' }],
};

function record(dollars: number): MessageCostRecord {
  return {
    dollars,
    unknown: false,
    model: 'gpt-4o-mini',
    promptTokens: 1000,
    completionTokens: 500,
    cachedTokens: 0,
    verified: true,
  };
}

describe('estimatePlanCost', () => {
  it('returns a dollar range from plan size × model price', () => {
    const estimate = estimatePlanCost({ model: 'gpt-4o-mini', plan: smallPlan });

    expect(estimate.unknown).toBe(false);
    expect(estimate.label).toBe('estimate');
    expect(estimate.high).toBeGreaterThanOrEqual(estimate.low);
    expect(estimate.low).toBeGreaterThan(0);
    expect(estimate.source).toBe('table');
  });

  it('calibrates with completed-build history', () => {
    const bare = estimatePlanCost({ model: 'gpt-4o-mini', plan: smallPlan });

    const blended = estimatePlanCost({
      model: 'gpt-4o-mini',
      plan: smallPlan,
      history: [record(0.4), record(0.5), record(0.9), record(1.2)],
    });

    expect(blended.source).toBe('blended');
    expect(blended.low).not.toBe(bare.low);
    expect(blended.high).toBeGreaterThanOrEqual(blended.low);
  });

  it('marks unverified list prices and unknown models', () => {
    const unverified = estimatePlanCost({
      model: 'claude-3-haiku-20240307',
      plan: smallPlan,
    });

    const priced = cost('claude-3-haiku-20240307', 1000, 1000);

    if (!priced.unknown && priced.verified === false) {
      expect(unverified.verified).toBe(false);
    }

    const unknown = estimatePlanCost({ model: 'totally-unknown-model-xyz', plan: smallPlan });
    expect(unknown.unknown).toBe(true);
    expect(unknown.low).toBe(0);
    expect(unknown.high).toBe(0);
  });

  it('includes a planning-call cost when usage is provided', () => {
    const estimate = estimatePlanCost({
      model: 'gpt-4o-mini',
      plan: smallPlan,
      planningCall: { promptTokens: 1_000, completionTokens: 400 },
    });

    const expected = cost('gpt-4o-mini', 1_000, 400);

    if (!expected.unknown) {
      expect(estimate.planningCall).toBe(expected.dollars);
    }
  });
});
