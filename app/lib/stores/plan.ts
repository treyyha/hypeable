/**
 * Plan-first UI state. Settings persist in this browser only.
 */
import { atom, map } from 'nanostores';
import {
  MAX_PLAN_RETRIES,
  PLAN_SETTINGS_KEY,
  buildLoopPlanContext,
  defaultTickedFeatureIds,
  parsePlanReply,
  readPlanSettings,
  type HypeablePlan,
  type PlanSettings,
} from '~/lib/plan';

const browserStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

function loadSettings(): PlanSettings {
  try {
    return readPlanSettings(browserStorage()?.getItem(PLAN_SETTINGS_KEY));
  } catch {
    return readPlanSettings(null);
  }
}

function persistSettings(settings: PlanSettings): void {
  try {
    browserStorage()?.setItem(PLAN_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Quota or private-mode failures must not break chat.
  }
}

export const planSettingsStore = map<PlanSettings>(loadSettings());

export function setPlanSettings(patch: Partial<PlanSettings>): void {
  const next = { ...planSettingsStore.get(), ...patch };
  planSettingsStore.set(next);
  persistSettings(next);
}

export type PendingPlan = {
  intro: string;
  raw: string;
  error?: string;
  plan: HypeablePlan | null;
  retries: number;
  tickedIds: string[];
  extraFeature: string;
};

export type PlanUiState = {
  pending: PendingPlan | null;
  approved: HypeablePlan | null;
  skipNextTurn: boolean;
  forceNextTurn: boolean;
  panelOpen: boolean;
  lastUserPrompt: string;
};

export const planStore = map<PlanUiState>({
  pending: null,
  approved: null,
  skipNextTurn: false,
  forceNextTurn: false,
  panelOpen: true,
  lastUserPrompt: '',
});

export const planSkipTick = atom(0);

export function rememberPlanningPrompt(text: string): void {
  planStore.set({ ...planStore.get(), lastUserPrompt: text });
}

export function consumePlanTurnFlags(): { skipThisTurn: boolean; forcePlan: boolean } {
  const current = planStore.get();
  const skipThisTurn = current.skipNextTurn;
  const forcePlan = current.forceNextTurn && !skipThisTurn;

  if (current.skipNextTurn || current.forceNextTurn) {
    planStore.set({ ...current, skipNextTurn: false, forceNextTurn: false });
  }

  return { skipThisTurn, forcePlan };
}

export function skipPlanThisTurn(): void {
  planStore.set({ ...planStore.get(), skipNextTurn: true, forceNextTurn: false });
  planSkipTick.set(planSkipTick.get() + 1);
}

export function requestForcedPlan(input: { error: string; count: number; tried?: readonly string[] }): string {
  planStore.set({ ...planStore.get(), forceNextTurn: true, skipNextTurn: false, pending: null });

  return buildLoopPlanContext(input);
}

export function ingestPlanReply(text: string): void {
  const parsed = parsePlanReply(text);
  const current = planStore.get();
  const retries = current.pending?.retries ?? 0;

  if (parsed.ok) {
    planStore.set({
      ...current,
      pending: {
        intro: parsed.intro,
        raw: text,
        plan: parsed.plan,
        retries,
        tickedIds: defaultTickedFeatureIds(parsed.plan),
        extraFeature: '',
      },
    });

    return;
  }

  planStore.set({
    ...current,
    pending: {
      intro: parsed.intro,
      raw: parsed.raw,
      error: parsed.error,
      plan: null,
      retries,
      tickedIds: [],
      extraFeature: '',
    },
  });
}

export function setPlanTickedIds(ids: string[]): void {
  const pending = planStore.get().pending;

  if (!pending) {
    return;
  }

  planStore.set({ ...planStore.get(), pending: { ...pending, tickedIds: ids } });
}

export function setPlanExtraFeature(text: string): void {
  const pending = planStore.get().pending;

  if (!pending) {
    return;
  }

  planStore.set({ ...planStore.get(), pending: { ...pending, extraFeature: text } });
}

export function addPlanFeatureLine(): void {
  const pending = planStore.get().pending;

  if (!pending?.plan) {
    return;
  }

  const text = pending.extraFeature.trim();

  if (!text) {
    return;
  }

  const id = `custom-${pending.plan.features.length + 1}`;

  const plan: HypeablePlan = {
    ...pending.plan,
    features: [...pending.plan.features, { id, text }],
  };

  planStore.set({
    ...planStore.get(),
    pending: {
      ...pending,
      plan,
      tickedIds: [...pending.tickedIds, id],
      extraFeature: '',
    },
  });
}

export function incrementPlanRetry(): boolean {
  const pending = planStore.get().pending;
  const retries = (pending?.retries ?? 0) + 1;

  if (retries > MAX_PLAN_RETRIES) {
    return false;
  }

  planStore.set({
    ...planStore.get(),
    pending: pending ? { ...pending, retries } : null,
  });

  return true;
}

export function approvePendingPlan(plan: HypeablePlan): void {
  planStore.set({
    ...planStore.get(),
    pending: null,
    approved: plan,
    skipNextTurn: true,
    forceNextTurn: false,
    panelOpen: true,
  });
}

export function cancelPendingPlan(): void {
  planStore.set({ ...planStore.get(), pending: null });
}

export function setPlanPanelOpen(open: boolean): void {
  planStore.set({ ...planStore.get(), panelOpen: open });
}

export function clearApprovedPlan(): void {
  planStore.set({ ...planStore.get(), approved: null });
}
