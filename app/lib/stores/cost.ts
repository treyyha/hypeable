/**
 * Live dollar meter. Session and daily totals live in this browser only
 * (`hypeable:cost:v1`); provider-side spending limits remain the real backstop.
 */
import { atom, map } from 'nanostores';
import {
  applyCaps,
  applyCustomPrice,
  applyNewSession,
  applyRaiseCap,
  applyUsage,
  costFromEntry,
  preSendDecision,
  removeUsage,
  type UsageEntry,
} from '~/lib/cost/apply';
import { estimateTokensFromText } from '~/lib/cost/calc';
import { type CapDecision, type CapKind } from '~/lib/cost/caps';
import {
  applyDayRollover,
  readPersistedCost,
  writePersistedCost,
  type CostSnapshot,
  type CustomModelPriceRecord,
} from '~/lib/cost/persist';
import { formatReceipt } from '~/lib/cost/receipt';
import { extractTokenUsage } from '~/lib/cost/usage';
import { recordLedgerFromUsage } from '~/lib/stores/ledger';

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

function now(): Date {
  return new Date();
}

function persist(snapshot: CostSnapshot): CostSnapshot {
  writePersistedCost(browserStorage(), snapshot);
  return snapshot;
}

export const costStore = map<CostSnapshot>(readPersistedCost(browserStorage(), now()));

export const costAbortTick = atom(0);

export type CapDialogState = {
  kind: CapKind;
  spent: number;
  cap: number;
  reason: 'hit' | 'would-cross';
  estimate?: number;
};

export const capDialogStore = atom<CapDialogState | null>(null);

export const costToastStore = atom<CapKind | null>(null);

function current(): CostSnapshot {
  const snapshot = costStore.get();
  const rolled = applyDayRollover(snapshot, now());

  if (rolled === snapshot) {
    return snapshot;
  }

  costStore.set(persist(rolled));

  return rolled;
}

function commit(snapshot: CostSnapshot, decision?: CapDecision): CostSnapshot {
  costStore.set(persist(snapshot));

  if (decision?.toast80) {
    costToastStore.set(decision.toast80);
  }

  if (decision?.abort && decision.blocking) {
    capDialogStore.set({
      kind: decision.blocking,
      spent: decision.blocking === 'daily' ? snapshot.dailyTotal : snapshot.sessionTotal,
      cap: snapshot.caps[decision.blocking],
      reason: 'hit',
    });
    costAbortTick.set(costAbortTick.get() + 1);
  }

  return snapshot;
}

export function recordUsage(entry: UsageEntry): CapDecision {
  const { snapshot, decision } = applyUsage(current(), entry, now());
  commit(snapshot, decision);

  if (!entry.pending) {
    const record = snapshot.messages[entry.id];

    if (record) {
      recordLedgerFromUsage({
        id: entry.id,
        model: record.model,
        provider: record.provider,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        dollars: record.dollars,
        verified: record.verified,
      });
    }
  }

  return decision;
}

export function beginPendingUsage(entry: UsageEntry): CapDecision {
  const previous = current().messages[entry.id];
  const { snapshot, decision } = applyUsage(current(), { ...entry, pending: true }, now());

  // First estimate of a send must not abort; later updates are the mid-stream hard stop.
  commit(snapshot, previous ? decision : { ...decision, abort: false });

  return decision;
}

export function settleUsage(entry: UsageEntry): CapDecision {
  return recordUsage({ ...entry, pending: false });
}

export function discardPendingUsage(id: string): void {
  commit(removeUsage(current(), id, now()));
}

export function startNewSession(): void {
  capDialogStore.set(null);
  commit(applyNewSession(current(), now()));
}

export function setCostCaps(caps: { session?: number; daily?: number }): void {
  const currentCaps = current().caps;
  commit(
    applyCaps(
      current(),
      {
        session: caps.session ?? currentCaps.session,
        daily: caps.daily ?? currentCaps.daily,
      },
      now(),
    ),
  );
}

export function raiseCostCap(kind: CapKind): void {
  capDialogStore.set(null);
  commit(applyRaiseCap(current(), kind, now()));
}

export function setCustomModelPrice(model: string, price: CustomModelPriceRecord | null): void {
  commit(applyCustomPrice(current(), model, price, now()));
}

export function dismissCapDialog(): void {
  capDialogStore.set(null);
}

export function showWouldCrossDialog(kind: CapKind, estimate: number): void {
  const snapshot = current();
  capDialogStore.set({
    kind,
    spent: kind === 'daily' ? snapshot.dailyTotal : snapshot.sessionTotal,
    cap: snapshot.caps[kind],
    reason: 'would-cross',
    estimate,
  });
}

export function evaluateOutgoingCost(estimatedDollars: number): CapDecision {
  const snapshot = current();
  const decision = preSendDecision(snapshot, estimatedDollars, now());

  if (decision.blocking) {
    capDialogStore.set({
      kind: decision.blocking,
      spent: decision.blocking === 'daily' ? snapshot.dailyTotal : snapshot.sessionTotal,
      cap: snapshot.caps[decision.blocking],
      reason: 'hit',
    });
  } else if (decision.wouldCross) {
    showWouldCrossDialog(decision.wouldCross, estimatedDollars);
  }

  return decision;
}

export function estimateRequestCost(input: {
  model: string;
  provider?: string;
  contextText: string;
  completionHint?: string;
}): { dollars: number; unknown: boolean; promptTokens: number } {
  const promptTokens = estimateTokensFromText(input.contextText);
  const completionTokens = estimateTokensFromText(input.completionHint ?? '');

  const result = costFromEntry(current(), {
    id: 'estimate',
    model: input.model,
    provider: input.provider,
    promptTokens,
    completionTokens,
  });

  return { dollars: result.dollars, unknown: result.unknown, promptTokens };
}

export function copySessionReceipt(): string {
  return formatReceipt(current());
}

export function pendingUsageId(scope: string): string {
  return `pending:${scope}`;
}

export function ingestUsageAnnotation(
  data: unknown,
  fallback: { id?: string; model?: string; provider?: string } = {},
): CapDecision | undefined {
  const tokens = extractTokenUsage(data);

  if (!tokens) {
    return undefined;
  }

  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  const id =
    fallback.id ||
    (typeof record.id === 'string' && record.id) ||
    `usage:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const model = (typeof record.model === 'string' && record.model) || fallback.model || 'unknown';
  const provider = (typeof record.provider === 'string' && record.provider) || fallback.provider;

  return settleUsage({
    id,
    model,
    provider,
    promptTokens: tokens.promptTokens,
    completionTokens: tokens.completionTokens,
    cachedTokens: tokens.cachedTokens,
    actualCost: tokens.cost,
  });
}

type CapResume = () => void;

let capResume: CapResume | null = null;

export function registerCapResume(fn: CapResume | null): () => void {
  capResume = fn;

  return () => {
    if (capResume === fn) {
      capResume = null;
    }
  };
}

export function resumeAfterCapWarning(): void {
  const fn = capResume;
  capResume = null;
  dismissCapDialog();
  fn?.();
}

export { formatReceipt };
