import { describe, expect, it } from 'vitest';
import { applyCustomPrice, applyNewSession, applyRaiseCap, applyUsage, preSendDecision, removeUsage } from './apply';
import { emptySnapshot } from './persist';

describe('cost state transitions', () => {
  const now = new Date('2026-10-25T15:00:00');

  it('records a known-model spend against session, day, and per-model totals', () => {
    const { snapshot } = applyUsage(
      emptySnapshot(now),
      { id: 'm1', model: 'gpt-4o-mini', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );
    expect(snapshot.sessionTotal).toBe(0.15);
    expect(snapshot.dailyTotal).toBe(0.15);
    expect(snapshot.byModel['gpt-4o-mini']?.dollars).toBe(0.15);
    expect(snapshot.messages.m1.dollars).toBe(0.15);
    expect(snapshot.messages.m1.verified).toBe(true);
  });

  it('flags unverified list prices on the per-model breakdown', () => {
    const { snapshot } = applyUsage(
      emptySnapshot(now),
      { id: 'm1', model: 'claude-3-haiku-20240307', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );
    expect(snapshot.messages.m1.verified).toBe(false);
    expect(snapshot.byModel['claude-3-haiku-20240307']?.unverified).toBe(true);
  });

  it('is idempotent for the same message id', () => {
    const first = applyUsage(
      emptySnapshot(now),
      { id: 'm1', model: 'gpt-4o-mini', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );
    const second = applyUsage(
      first.snapshot,
      { id: 'm1', model: 'gpt-4o-mini', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );
    expect(second.snapshot.sessionTotal).toBe(0.15);
  });

  it('replaces a pending estimate with billed usage', () => {
    const pending = applyUsage(
      emptySnapshot(now),
      {
        id: 'pending:chat',
        model: 'gpt-4o-mini',
        promptTokens: 1_000_000,
        completionTokens: 0,
        pending: true,
      },
      now,
    );
    const settled = applyUsage(
      pending.snapshot,
      { id: 'pending:chat', model: 'gpt-4o-mini', promptTokens: 2_000_000, completionTokens: 0 },
      now,
    );
    expect(settled.snapshot.sessionTotal).toBe(0.3);
    expect(settled.snapshot.messages['pending:chat'].pending).toBeFalsy();
  });

  it('keeps tokens on an unknown model so the UI can show a set-price prompt', () => {
    const { snapshot } = applyUsage(
      emptySnapshot(now),
      { id: 'u1', model: 'mystery-model', promptTokens: 100, completionTokens: 20 },
      now,
    );
    expect(snapshot.messages.u1.unknown).toBe(true);
    expect(snapshot.messages.u1.promptTokens).toBe(100);
    expect(snapshot.sessionTotal).toBe(0);
  });

  it('blocks a send when the session cap is already hit', () => {
    const spent = applyUsage(
      emptySnapshot(now),
      { id: 'm1', model: 'gpt-4o', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );

    const decision = preSendDecision(spent.snapshot, 0.01, now);
    expect(spent.snapshot.sessionTotal).toBe(2.5);
    expect(decision.blocking).toBe('session');
  });

  it('starts a new session without wiping today or the caps', () => {
    let state = emptySnapshot(now);
    state.caps.session = 5;
    state = applyUsage(
      state,
      { id: 'm1', model: 'gpt-4o-mini', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    ).snapshot;

    const next = applyNewSession(state, now);
    expect(next.sessionTotal).toBe(0);
    expect(next.dailyTotal).toBe(0.15);
    expect(next.caps.session).toBe(5);
    expect(next.sessionId).not.toBe(state.sessionId);
  });

  it('raises the blocking cap and clears the 80% flag', () => {
    const spent = applyUsage(
      emptySnapshot(now),
      { id: 'm1', model: 'gpt-4o', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );

    const raised = applyRaiseCap(spent.snapshot, 'session', now);
    expect(raised.caps.session).toBeGreaterThan(spent.snapshot.sessionTotal);
    expect(raised.warned80Session).toBe(false);
  });

  it('applies a custom price and can drop a pending estimate', () => {
    const priced = applyCustomPrice(emptySnapshot(now), 'mystery-model', { input: 1, output: 2 }, now);

    const spent = applyUsage(
      priced,
      { id: 'm1', model: 'mystery-model', promptTokens: 1_000_000, completionTokens: 0 },
      now,
    );
    expect(spent.snapshot.sessionTotal).toBe(1);

    const cleared = removeUsage(spent.snapshot, 'm1', now);
    expect(cleared.sessionTotal).toBe(0);
    expect(cleared.messages.m1).toBeUndefined();
  });
});
