/**
 * Plan-mode knobs. Stored in this browser only; nothing is sent anywhere.
 */

export const PLAN_SETTINGS_KEY = 'hypeable:plan:v1';

export type PlanSettings = {
  enabled: boolean;
  everyRequest: boolean;
};

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  enabled: true,
  everyRequest: false,
};

export function normalizePlanSettings(value: unknown): PlanSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PLAN_SETTINGS };
  }

  const record = value as Record<string, unknown>;

  return {
    enabled: record.enabled !== false,
    everyRequest: record.everyRequest === true,
  };
}

export function readPlanSettings(raw: string | null | undefined): PlanSettings {
  if (!raw) {
    return { ...DEFAULT_PLAN_SETTINGS };
  }

  try {
    return normalizePlanSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAN_SETTINGS };
  }
}
