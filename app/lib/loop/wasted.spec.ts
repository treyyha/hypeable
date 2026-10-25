import { describe, expect, it } from 'vitest';
import { sumMessageCostsSince, wastedCostSince } from './wasted';

describe('wasted cost', () => {
  it('is the session-total delta since the first occurrence', () => {
    expect(wastedCostSince(1.25, 1.0)).toBe(0.25);
    expect(wastedCostSince(0.5, 1.0)).toBe(0);
  });

  it('sums settled message costs for the ids in the loop', () => {
    expect(
      sumMessageCostsSince(
        {
          a: { dollars: 0.1 },
          b: { dollars: 0.2, pending: true },
          c: { dollars: 0.05 },
        },
        ['a', 'b', 'c', 'missing'],
      ),
    ).toBe(0.15);
  });
});
