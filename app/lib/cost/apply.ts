/**
 * Pure cost-state transitions. The nanostore is a thin persistence wrapper
 * around these so tests never need a browser.
 */
import { cost, type CostResult } from './calc';
import { evaluateCaps, raisedCap, type CapDecision, type CapKind } from './caps';
import { dollarsFromNanos } from './money';
import { applyDayRollover, emptySnapshot, type CostSnapshot, type MessageCostRecord } from './persist';
import type { ApproximateReason, CallKind, UsagePrecision } from './usage';

export type UsageEntry = {
  id: string;
  model: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  cacheWrite1hTokens?: number;
  reasoningTokens?: number;
  reasoningIncludedInOutput?: boolean;
  imageTokens?: number;
  actualCost?: number;
  pending?: boolean;
  precision?: UsagePrecision;
  aborted?: boolean;
  maybeBilled?: boolean;
  callKind?: CallKind;
};

function toRecord(entry: UsageEntry, result: CostResult): MessageCostRecord {
  const approximate = result.unknown || result.approximate || entry.precision === 'estimate';
  const reasons: ApproximateReason[] = result.unknown ? result.approximateReasons : result.approximateReasons;

  return {
    dollars: result.dollars,
    nanos: result.unknown ? 0 : result.nanos,
    computedDollars: result.computedDollars,
    providerDollars: result.unknown ? undefined : result.providerDollars,
    unknown: result.unknown,
    model: entry.model,
    provider: entry.provider,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    cachedTokens: result.cachedTokens,
    cacheWriteTokens: result.cacheWriteTokens,
    cacheWrite1hTokens: result.cacheWrite1hTokens,
    reasoningTokens: result.reasoningTokens,
    imageTokens: result.imageTokens,
    pending: entry.pending,
    verified: result.unknown ? undefined : result.verified,
    approximate: approximate || undefined,
    approximateReasons: reasons.length > 0 ? reasons : undefined,
    precision: entry.precision ?? (result.unknown ? 'estimate' : result.precision),
    callKind: entry.callKind,
    aborted: entry.aborted || undefined,
    maybeBilled: entry.maybeBilled || undefined,
    divergenceNanos: result.unknown ? undefined : result.divergenceNanos,
  };
}

function addBreakdown(snapshot: CostSnapshot, record: MessageCostRecord, sign: 1 | -1): void {
  const key = record.model || 'unknown';
  const current = snapshot.byModel[key] ?? { dollars: 0, nanos: 0, promptTokens: 0, completionTokens: 0 };
  const nanos = (current.nanos ?? 0) + sign * recordNanos(record);
  const promptTokens = current.promptTokens + sign * record.promptTokens;
  const completionTokens = current.completionTokens + sign * record.completionTokens;
  const unknown = record.unknown || Boolean(current.unknown);
  const unverified = record.verified === false || record.approximate === true || Boolean(current.unverified);

  if (promptTokens <= 0 && completionTokens <= 0 && Math.abs(nanos) < 1) {
    delete snapshot.byModel[key];
    return;
  }

  snapshot.byModel[key] = {
    dollars: dollarsFromNanos(nanos),
    nanos,
    promptTokens: Math.max(0, promptTokens),
    completionTokens: Math.max(0, completionTokens),
    unknown: unknown || undefined,
    unverified: unverified || undefined,
  };
}

function recordNanos(record: MessageCostRecord): number {
  return typeof record.nanos === 'number' && Number.isFinite(record.nanos)
    ? record.nanos
    : Math.round(record.dollars * 1_000_000_000);
}

function subtractRecord(snapshot: CostSnapshot, record: MessageCostRecord): void {
  const nanos = recordNanos(record);
  snapshot.sessionTotalNanos = (snapshot.sessionTotalNanos ?? 0) - nanos;
  snapshot.dailyTotalNanos = (snapshot.dailyTotalNanos ?? 0) - nanos;
  snapshot.sessionTotal = dollarsFromNanos(snapshot.sessionTotalNanos);
  snapshot.dailyTotal = dollarsFromNanos(snapshot.dailyTotalNanos);
  snapshot.sessionPromptTokens -= record.promptTokens;
  snapshot.sessionCompletionTokens -= record.completionTokens;
  snapshot.dailyPromptTokens -= record.promptTokens;
  snapshot.dailyCompletionTokens -= record.completionTokens;
  addBreakdown(snapshot, record, -1);
}

function addRecord(snapshot: CostSnapshot, record: MessageCostRecord): void {
  const nanos = recordNanos(record);
  snapshot.sessionTotalNanos = (snapshot.sessionTotalNanos ?? 0) + nanos;
  snapshot.dailyTotalNanos = (snapshot.dailyTotalNanos ?? 0) + nanos;
  snapshot.sessionTotal = dollarsFromNanos(snapshot.sessionTotalNanos);
  snapshot.dailyTotal = dollarsFromNanos(snapshot.dailyTotalNanos);
  snapshot.sessionPromptTokens += record.promptTokens;
  snapshot.sessionCompletionTokens += record.completionTokens;
  snapshot.dailyPromptTokens += record.promptTokens;
  snapshot.dailyCompletionTokens += record.completionTokens;
  addBreakdown(snapshot, record, 1);
}

export function costFromEntry(snapshot: CostSnapshot, entry: UsageEntry): CostResult {
  return cost(entry.model, entry.promptTokens, entry.completionTokens, {
    cachedTokens: entry.cachedTokens,
    cacheWriteTokens: entry.cacheWriteTokens,
    cacheWrite1hTokens: entry.cacheWrite1hTokens,
    reasoningTokens: entry.reasoningTokens,
    reasoningIncludedInOutput: entry.reasoningIncludedInOutput,
    imageTokens: entry.imageTokens,
    actualCost: entry.actualCost,
    customPrices: snapshot.customPrices,
    provider: entry.provider,
    precision: entry.precision,
    aborted: entry.aborted,
    maybeBilled: entry.maybeBilled,
  });
}

export function applyUsage(
  snapshot: CostSnapshot,
  entry: UsageEntry,
  now: Date,
): { snapshot: CostSnapshot; decision: CapDecision } {
  const next = applyDayRollover(structuredClone(snapshot), now);
  const previous = next.messages[entry.id];

  if (previous) {
    subtractRecord(next, previous);
  }

  const record = toRecord(entry, costFromEntry(next, entry));
  next.messages[entry.id] = record;
  addRecord(next, record);

  const decision = evaluateCaps({
    sessionSpent: next.sessionTotal,
    dailySpent: next.dailyTotal,
    sessionCap: next.caps.session,
    dailyCap: next.caps.daily,
    warned80Session: next.warned80Session,
    warned80Daily: next.warned80Daily,
  });

  if (decision.toast80 === 'session') {
    next.warned80Session = true;
  }

  if (decision.toast80 === 'daily') {
    next.warned80Daily = true;
  }

  return { snapshot: next, decision };
}

export function removeUsage(snapshot: CostSnapshot, id: string, now: Date): CostSnapshot {
  const next = applyDayRollover(structuredClone(snapshot), now);
  const previous = next.messages[id];

  if (!previous) {
    return next;
  }

  subtractRecord(next, previous);
  delete next.messages[id];

  return next;
}

export function applyNewSession(snapshot: CostSnapshot, now: Date): CostSnapshot {
  const rolled = applyDayRollover(snapshot, now);
  const fresh = emptySnapshot(now, { caps: rolled.caps, customPrices: rolled.customPrices });
  fresh.dailyTotal = rolled.dailyTotal;
  fresh.dailyTotalNanos = rolled.dailyTotalNanos ?? 0;
  fresh.dailyPromptTokens = rolled.dailyPromptTokens;
  fresh.dailyCompletionTokens = rolled.dailyCompletionTokens;
  fresh.dayKey = rolled.dayKey;
  fresh.warned80Daily = rolled.warned80Daily;

  return fresh;
}

export function applyCaps(snapshot: CostSnapshot, caps: CostSnapshot['caps'], now: Date): CostSnapshot {
  const next = applyDayRollover(structuredClone(snapshot), now);
  next.caps = {
    session: Number.isFinite(caps.session) && caps.session >= 0 ? caps.session : next.caps.session,
    daily: Number.isFinite(caps.daily) && caps.daily >= 0 ? caps.daily : next.caps.daily,
  };

  if (capOpen(next.sessionTotal, next.caps.session)) {
    next.warned80Session = false;
  }

  if (capOpen(next.dailyTotal, next.caps.daily)) {
    next.warned80Daily = false;
  }

  return next;
}

function capOpen(spent: number, cap: number): boolean {
  return cap <= 0 || spent < cap * 0.8;
}

export function applyRaiseCap(snapshot: CostSnapshot, kind: CapKind, now: Date): CostSnapshot {
  const next = applyDayRollover(structuredClone(snapshot), now);
  const spent = kind === 'daily' ? next.dailyTotal : next.sessionTotal;
  next.caps[kind] = raisedCap(next.caps[kind], spent);

  if (kind === 'session') {
    next.warned80Session = false;
  } else {
    next.warned80Daily = false;
  }

  return next;
}

export function applyCustomPrice(
  snapshot: CostSnapshot,
  model: string,
  price: CostSnapshot['customPrices'][string] | null,
  now: Date,
): CostSnapshot {
  const next = applyDayRollover(structuredClone(snapshot), now);
  const key = model.trim();

  if (!key) {
    return next;
  }

  if (!price) {
    delete next.customPrices[key];
  } else {
    next.customPrices[key] = price;
  }

  return next;
}

export function preSendDecision(snapshot: CostSnapshot, estimatedDollars: number, now: Date): CapDecision {
  const rolled = applyDayRollover(snapshot, now);

  return evaluateCaps({
    sessionSpent: rolled.sessionTotal,
    dailySpent: rolled.dailyTotal,
    sessionCap: rolled.caps.session,
    dailyCap: rolled.caps.daily,
    extra: estimatedDollars,
    warned80Session: rolled.warned80Session,
    warned80Daily: rolled.warned80Daily,
  });
}
