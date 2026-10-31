/**
 * Property-style checks for the cost meter: hostile or broken usage numbers
 * must never produce a negative, NaN or infinite spend, and replaying the
 * same chunk must not double-count.
 */
import { describe, expect, it } from 'vitest';
import { applyUsage, type UsageEntry } from '~/lib/cost/apply';
import { cost } from '~/lib/cost/calc';
import { evaluateCaps } from '~/lib/cost/caps';
import { applyDayRollover, emptySnapshot, loadSnapshot } from '~/lib/cost/persist';

const HOSTILE = [0, -1, -1e12, 1, 1.5, 1e6, 1e12, 1e15, Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity];
const CUSTOM = { 'prop-model': { input: 3, output: 15, cachedInput: 0.3, cacheWrite: 3.75 } };

function lcg(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

describe('cost() with hostile token counts', () => {
  it('never returns negative, NaN or infinite dollars', () => {
    for (const prompt of HOSTILE) {
      for (const completion of HOSTILE) {
        for (const cached of HOSTILE) {
          const result = cost('prop-model', prompt, completion, {
            cachedTokens: cached,
            cacheWriteTokens: cached,
            reasoningTokens: completion,
            customPrices: CUSTOM,
          });

          expect(finiteNonNegative(result.dollars), `${prompt}/${completion}/${cached}`).toBe(true);
          expect(finiteNonNegative(result.nanos), `${prompt}/${completion}/${cached} nanos`).toBe(true);
        }
      }
    }
  });

  it('ignores a negative or non-finite provider-reported cost', () => {
    for (const actualCost of [-5, NaN, Infinity, -Infinity]) {
      const result = cost('prop-model', 1000, 1000, { actualCost, customPrices: CUSTOM });

      expect(result.unknown).toBe(false);
      expect(result.source).toBe('custom');
      expect(finiteNonNegative(result.dollars)).toBe(true);
    }
  });

  it('is monotonic in tokens and additive within a micro-dollar', () => {
    const random = lcg(7);

    for (let i = 0; i < 500; i += 1) {
      const a = Math.floor(random() * 200_000);
      const b = Math.floor(random() * 200_000);
      const one = cost('prop-model', a, b, { customPrices: CUSTOM }).dollars;
      const more = cost('prop-model', a + 1, b + 1, { customPrices: CUSTOM }).dollars;
      const half = cost('prop-model', Math.floor(a / 2), Math.floor(b / 2), { customPrices: CUSTOM }).dollars;
      const rest = cost('prop-model', a - Math.floor(a / 2), b - Math.floor(b / 2), { customPrices: CUSTOM }).dollars;

      expect(more).toBeGreaterThanOrEqual(one);
      expect(Math.abs(half + rest - one)).toBeLessThanOrEqual(2e-6);
    }
  });

  it('an unknown model costs nothing but keeps its tokens', () => {
    const result = cost('nobody-prices-this-model', 1000, 1000);

    expect(result.unknown).toBe(true);
    expect(result.dollars).toBe(0);
    expect(result.promptTokens).toBe(1000);
  });
});

describe('applyUsage()', () => {
  const at = new Date(2026, 9, 31, 12, 0, 0);

  const entry = (id: string, promptTokens: number): UsageEntry => ({
    id,
    model: 'prop-model',
    promptTokens,
    completionTokens: promptTokens,
  });

  function withCustom() {
    const snapshot = emptySnapshot(at);
    snapshot.customPrices = CUSTOM as never;

    return snapshot;
  }

  it('replaying the same chunk does not double-count', () => {
    let snapshot = withCustom();

    for (let i = 0; i < 50; i += 1) {
      snapshot = applyUsage(snapshot, entry('m1', 10_000), at).snapshot;
    }

    const once = applyUsage(withCustom(), entry('m1', 10_000), at).snapshot;

    expect(snapshot.dailyTotal).toBeCloseTo(once.dailyTotal, 9);
    expect(snapshot.sessionTotal).toBeCloseTo(once.sessionTotal, 9);
  });

  it('totals equal the sum of message records after random updates', () => {
    const random = lcg(42);

    let snapshot = withCustom();

    for (let i = 0; i < 400; i += 1) {
      const id = `m${Math.floor(random() * 20)}`;
      snapshot = applyUsage(snapshot, entry(id, Math.floor(random() * 50_000)), at).snapshot;
    }

    const sum = Object.values(snapshot.messages).reduce((total, record) => total + record.dollars, 0);

    expect(snapshot.dailyTotal).toBeCloseTo(sum, 5);
    expect(snapshot.sessionTotal).toBeCloseTo(sum, 5);
  });

  it('midnight rolls the daily total but keeps the session', () => {
    const before = applyUsage(withCustom(), entry('m1', 100_000), new Date(2026, 9, 31, 23, 59, 59)).snapshot;
    const after = applyDayRollover(before, new Date(2026, 10, 1, 0, 0, 1));

    expect(before.dailyTotal).toBeGreaterThan(0);
    expect(after.dailyTotal).toBe(0);
    expect(after.sessionTotal).toBeCloseTo(before.sessionTotal, 9);
  });

  it('a cap of exactly the spend is a hard stop, and 0 disables it', () => {
    expect(evaluateCaps({ sessionSpent: 2, dailySpent: 2, sessionCap: 2, dailyCap: 10 }).abort).toBe(true);
    expect(evaluateCaps({ sessionSpent: 1e9, dailySpent: 1e9, sessionCap: 0, dailyCap: 0 }).abort).toBe(false);
    expect(evaluateCaps({ sessionSpent: NaN, dailySpent: 0, sessionCap: 2, dailyCap: 10 }).session).toBe('ok');
  });
});

describe('persisted snapshot parsing', () => {
  const at = new Date(2026, 9, 31, 12);

  it.each([
    'not json',
    '[]',
    'null',
    '{"version":999}',
    '{"version":1,"dailyTotal":-50,"sessionTotal":"x","caps":{"session":-1,"daily":"10"}}',
    '{"version":1,"messages":{"__proto__":{"dollars":5}},"byModel":null}',
    '{"version":1,"dailyTotal":1e400}',
  ])('loadSnapshot(%j) returns a usable meter', (raw) => {
    const snapshot = loadSnapshot(raw, at);

    expect(finiteNonNegative(snapshot.dailyTotal)).toBe(true);
    expect(finiteNonNegative(snapshot.sessionTotal)).toBe(true);
    expect(({} as Record<string, unknown>).dollars).toBeUndefined();
    expect(() => applyUsage(snapshot, { id: 'x', model: 'm', promptTokens: 1, completionTokens: 1 }, at)).not.toThrow();
  });
});
