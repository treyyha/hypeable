/**
 * Session / daily spending caps. 0 disables a cap. Enforcement is local to
 * this browser; provider-side limits are the real backstop.
 */

export const DEFAULT_SESSION_CAP = 2;
export const DEFAULT_DAILY_CAP = 10;
export const CAP_WARN_RATIO = 0.8;
export const CAP_RAISE_STEP = 2;

export type CapLevel = 'ok' | 'warn' | 'hit';
export type CapKind = 'session' | 'daily';

export function capLevel(spent: number, cap: number): CapLevel {
  if (!(cap > 0) || !Number.isFinite(spent)) {
    return 'ok';
  }

  if (spent >= cap) {
    return 'hit';
  }

  if (spent >= cap * CAP_WARN_RATIO) {
    return 'warn';
  }

  return 'ok';
}

export function wouldCrossCap(spent: number, extra: number, cap: number): boolean {
  if (!(cap > 0) || extra <= 0) {
    return false;
  }

  return spent < cap && spent + extra >= cap;
}

export type CapDecision = {
  session: CapLevel;
  daily: CapLevel;
  blocking: CapKind | null;
  wouldCross: CapKind | null;
  toast80: CapKind | null;
  abort: boolean;
};

export function evaluateCaps(input: {
  sessionSpent: number;
  dailySpent: number;
  sessionCap: number;
  dailyCap: number;
  extra?: number;
  warned80Session?: boolean;
  warned80Daily?: boolean;
}): CapDecision {
  const extra = input.extra ?? 0;
  const session = capLevel(input.sessionSpent + extra, input.sessionCap);
  const daily = capLevel(input.dailySpent + extra, input.dailyCap);
  const sessionNow = capLevel(input.sessionSpent, input.sessionCap);
  const dailyNow = capLevel(input.dailySpent, input.dailyCap);
  const blocking: CapKind | null = dailyNow === 'hit' ? 'daily' : sessionNow === 'hit' ? 'session' : null;

  const wouldCross: CapKind | null =
    extra > 0 && wouldCrossCap(input.dailySpent, extra, input.dailyCap)
      ? 'daily'
      : extra > 0 && wouldCrossCap(input.sessionSpent, extra, input.sessionCap)
        ? 'session'
        : null;

  let toast80: CapKind | null = null;

  if (daily === 'warn' && !input.warned80Daily) {
    toast80 = 'daily';
  } else if (session === 'warn' && !input.warned80Session) {
    toast80 = 'session';
  }

  return {
    session,
    daily,
    blocking,
    wouldCross: blocking ? null : wouldCross,
    toast80: blocking ? null : toast80,
    abort: daily === 'hit' || session === 'hit',
  };
}

export function raisedCap(currentCap: number, spent: number, step = CAP_RAISE_STEP): number {
  const floor = Math.max(currentCap, spent, 0);
  return Math.ceil(floor + step);
}
