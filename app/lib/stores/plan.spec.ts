import { beforeEach, describe, expect, it } from 'vitest';
import {
  approvePendingPlan,
  consumePlanTurnFlags,
  ingestPlanReply,
  planStore,
  requestForcedPlan,
  skipPlanThisTurn,
} from './plan';
import { shouldPlanThisTurn } from '~/lib/plan';

const validFence = `Intro.

\`\`\`hypeable-plan
${JSON.stringify({
  title: 'Notes',
  summary: 'Notes app',
  pages: [{ name: 'Home', purpose: 'List' }],
  data: [{ entity: 'Note', storage: 'localStorage' }],
  features: [
    { id: 'list', text: 'List notes' },
    { id: 'tags', text: 'Tag a note', optional: true },
  ],
  stack: ['Vite'],
  assumptions: ['offline'],
  risks: ['quota'],
})}
\`\`\`
`;

describe('plan store', () => {
  beforeEach(() => {
    planStore.set({
      pending: null,
      approved: null,
      skipNextTurn: false,
      forceNextTurn: false,
      panelOpen: true,
      lastUserPrompt: '',
    });
  });

  it('parses a valid reply into a pending plan', () => {
    ingestPlanReply(validFence);

    const pending = planStore.get().pending;
    expect(pending?.plan?.title).toBe('Notes');
    expect(pending?.tickedIds).toEqual(['list']);
  });

  it('keeps raw text when JSON is invalid', () => {
    ingestPlanReply('```hypeable-plan\n{nope}\n```');
    expect(planStore.get().pending?.plan).toBeNull();
    expect(planStore.get().pending?.error).toMatch(/JSON|valid/i);
  });

  it('skip and force flags are consumed once', () => {
    skipPlanThisTurn();
    expect(consumePlanTurnFlags()).toEqual({ skipThisTurn: true, forcePlan: false });
    expect(consumePlanTurnFlags()).toEqual({ skipThisTurn: false, forcePlan: false });
  });

  it('loop Replan forces the plan gate and includes the error', () => {
    const text = requestForcedPlan({
      error: 'TypeError: map of undefined',
      count: 3,
      tried: ['rewrote App.tsx'],
    });

    expect(text).toContain('TypeError: map of undefined');
    expect(text).toContain('rewrote App.tsx');

    const flags = consumePlanTurnFlags();
    expect(flags.forcePlan).toBe(true);
    expect(
      shouldPlanThisTurn({
        planModeEnabled: false,
        planEveryRequest: false,
        skipThisTurn: flags.skipThisTurn,
        forcePlan: flags.forcePlan,
        isFirstBuildRequest: false,
        workspaceEmpty: false,
        chatMode: 'build',
      }),
    ).toBe(true);
  });

  it('approve stores the plan and skips the next (build) turn', () => {
    ingestPlanReply(validFence);

    const plan = planStore.get().pending?.plan;
    expect(plan).toBeTruthy();

    if (plan) {
      approvePendingPlan(plan);
    }

    expect(planStore.get().approved?.title).toBe('Notes');
    expect(planStore.get().pending).toBeNull();
    expect(consumePlanTurnFlags().skipThisTurn).toBe(true);
  });
});
