import { describe, expect, it } from 'vitest';
import { isFirstBuildRequest, isWorkspaceEmpty, shouldPlanThisTurn, type PlanGateInput } from './gate';

const base: PlanGateInput = {
  planModeEnabled: true,
  planEveryRequest: false,
  skipThisTurn: false,
  forcePlan: false,
  isFirstBuildRequest: true,
  workspaceEmpty: true,
  chatMode: 'build',
};

describe('shouldPlanThisTurn', () => {
  it('plans the first build in an empty workspace when plan mode is on', () => {
    expect(shouldPlanThisTurn(base)).toBe(true);
  });

  it('skips when the user hits Skip plan', () => {
    expect(shouldPlanThisTurn({ ...base, skipThisTurn: true })).toBe(false);
  });

  it('skips later requests unless plan-every-request is on', () => {
    expect(shouldPlanThisTurn({ ...base, isFirstBuildRequest: false })).toBe(false);
    expect(shouldPlanThisTurn({ ...base, workspaceEmpty: false })).toBe(false);
    expect(shouldPlanThisTurn({ ...base, isFirstBuildRequest: false, planEveryRequest: true })).toBe(true);
  });

  it('does not plan discuss mode, and force-plan wins except skip', () => {
    expect(shouldPlanThisTurn({ ...base, chatMode: 'discuss', forcePlan: true })).toBe(false);
    expect(shouldPlanThisTurn({ ...base, planModeEnabled: false, forcePlan: true })).toBe(true);
    expect(shouldPlanThisTurn({ ...base, forcePlan: true, skipThisTurn: true })).toBe(false);
  });
});

describe('helpers', () => {
  it('treats zero files / zero user messages as first empty build', () => {
    expect(isWorkspaceEmpty(0)).toBe(true);
    expect(isWorkspaceEmpty(2)).toBe(false);
    expect(isFirstBuildRequest(0)).toBe(true);
    expect(isFirstBuildRequest(1)).toBe(false);
  });
});
