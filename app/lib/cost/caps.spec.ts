import { describe, expect, it } from 'vitest';
import { capLevel, evaluateCaps, raisedCap, wouldCrossCap } from './caps';

describe('spending caps', () => {
  it('treats a cap of 0 as off', () => {
    expect(capLevel(100, 0)).toBe('ok');
    expect(wouldCrossCap(1, 10, 0)).toBe(false);
  });

  it('warns at 80% and hits at 100%', () => {
    expect(capLevel(1.59, 2)).toBe('ok');
    expect(capLevel(1.6, 2)).toBe('warn');
    expect(capLevel(2, 2)).toBe('hit');
    expect(capLevel(2.1, 2)).toBe('hit');
  });

  it('blocks a send when the cap is already hit', () => {
    const decision = evaluateCaps({
      sessionSpent: 2,
      dailySpent: 2,
      sessionCap: 2,
      dailyCap: 10,
    });
    expect(decision.blocking).toBe('session');
    expect(decision.abort).toBe(true);
  });

  it('prefers the daily cap when both are exhausted', () => {
    const decision = evaluateCaps({
      sessionSpent: 10,
      dailySpent: 10,
      sessionCap: 2,
      dailyCap: 10,
    });
    expect(decision.blocking).toBe('daily');
  });

  it('warns before a send that would cross the cap', () => {
    const decision = evaluateCaps({
      sessionSpent: 1.5,
      dailySpent: 1.5,
      sessionCap: 2,
      dailyCap: 10,
      extra: 0.6,
    });
    expect(decision.blocking).toBeNull();
    expect(decision.wouldCross).toBe('session');
  });

  it('signals a one-shot 80% toast until it has been acknowledged', () => {
    const first = evaluateCaps({
      sessionSpent: 1.7,
      dailySpent: 1.7,
      sessionCap: 2,
      dailyCap: 10,
    });
    expect(first.toast80).toBe('session');

    const again = evaluateCaps({
      sessionSpent: 1.8,
      dailySpent: 1.8,
      sessionCap: 2,
      dailyCap: 10,
      warned80Session: true,
    });
    expect(again.toast80).toBeNull();
  });

  it('aborts once extra spend reaches 100% mid-stream', () => {
    const pending = evaluateCaps({
      sessionSpent: 1.9,
      dailySpent: 1.9,
      sessionCap: 2,
      dailyCap: 10,
      extra: 0.2,
    });
    expect(pending.abort).toBe(true);
    expect(pending.blocking).toBeNull();
    expect(pending.wouldCross).toBe('session');

    const recorded = evaluateCaps({
      sessionSpent: 2.1,
      dailySpent: 2.1,
      sessionCap: 2,
      dailyCap: 10,
    });
    expect(recorded.abort).toBe(true);
    expect(recorded.blocking).toBe('session');
  });

  it('raises a cap to spent plus a step so the user can keep working', () => {
    expect(raisedCap(2, 2.4)).toBe(5);
  });
});
