import { describe, expect, it } from 'vitest';
import { dollarsFromNanos, dollarsToNanos, roundDollars, tokensToNanos } from './money';

describe('nano-dollar arithmetic', () => {
  it('converts tokens × $/MTok without losing a single cheap token', () => {
    expect(tokensToNanos(1, 0.006)).toBe(6);
    expect(dollarsFromNanos(6)).toBe(0);
    expect(dollarsFromNanos(tokensToNanos(1_000_000, 0.006))).toBe(0.006);
  });

  it('round-trips micro-dollar display amounts', () => {
    expect(dollarsFromNanos(dollarsToNanos(0.15))).toBe(0.15);
    expect(dollarsFromNanos(dollarsToNanos(0.000001))).toBe(0.000001);
  });

  it('keeps the same rounding as the pill for many small adds', () => {
    let nanos = 0;

    for (let i = 0; i < 1_000; i += 1) {
      nanos += tokensToNanos(1, 0.15);
    }

    expect(dollarsFromNanos(nanos)).toBe(roundDollars(0.00015));
  });

  it('property: sum-then-round matches the pill for shuffled token batches', () => {
    const prices = [0.006, 0.15, 1.25, 3, 15];
    const batches = [1, 7, 64, 999, 10_000, 1_000_000];

    for (const price of prices) {
      let nanos = 0;
      let tokens = 0;

      for (const batch of batches) {
        nanos += tokensToNanos(batch, price);
        tokens += batch;
      }

      expect(dollarsFromNanos(nanos)).toBe(dollarsFromNanos(tokensToNanos(tokens, price)));
      expect(dollarsFromNanos(nanos)).toBe(roundDollars(tokens * price * 1e-6));
    }
  });
});
