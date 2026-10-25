/**
 * Decide whether this send should ask the model for a plan instead of code.
 */

export type ChatMode = 'discuss' | 'build';

export type PlanGateInput = {
  planModeEnabled: boolean;
  planEveryRequest: boolean;
  skipThisTurn: boolean;
  forcePlan: boolean;
  isFirstBuildRequest: boolean;
  workspaceEmpty: boolean;
  chatMode: ChatMode;
};

export function shouldPlanThisTurn(input: PlanGateInput): boolean {
  if (input.chatMode !== 'build') {
    return false;
  }

  if (input.skipThisTurn) {
    return false;
  }

  if (input.forcePlan) {
    return true;
  }

  if (!input.planModeEnabled) {
    return false;
  }

  if (input.planEveryRequest) {
    return true;
  }

  return input.isFirstBuildRequest && input.workspaceEmpty;
}

export function isWorkspaceEmpty(fileCount: number): boolean {
  return fileCount <= 0;
}

export function isFirstBuildRequest(userMessageCount: number): boolean {
  return userMessageCount <= 0;
}
