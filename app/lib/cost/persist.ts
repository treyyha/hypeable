/**
 * Versioned localStorage snapshot for the cost meter. Missing or corrupted
 * payloads fall back to zeros so a bad write can never crash the app.
 */
import { DEFAULT_DAILY_CAP, DEFAULT_SESSION_CAP } from './caps';

export const COST_STORAGE_KEY = 'hypeable:cost:v1';
export const COST_STORAGE_VERSION = 1;

export type MessageCostRecord = {
  dollars: number;
  unknown: boolean;
  model: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  pending?: boolean;
};

export type ModelBreakdown = {
  dollars: number;
  promptTokens: number;
  completionTokens: number;
  unknown?: boolean;
};

export type CustomModelPriceRecord = {
  input: number;
  output: number;
  cachedInput?: number;
};

export type CostSnapshot = {
  version: typeof COST_STORAGE_VERSION;
  sessionId: string;
  sessionStartedAt: number;
  sessionTotal: number;
  sessionPromptTokens: number;
  sessionCompletionTokens: number;
  dayKey: string;
  dailyTotal: number;
  dailyPromptTokens: number;
  dailyCompletionTokens: number;
  messages: Record<string, MessageCostRecord>;
  byModel: Record<string, ModelBreakdown>;
  caps: { session: number; daily: number };
  customPrices: Record<string, CustomModelPriceRecord>;
  warned80Session: boolean;
  warned80Daily: boolean;
};

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function localDayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function newSessionId(now: Date): string {
  return `s-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySnapshot(
  now: Date,
  extras: Partial<Pick<CostSnapshot, 'caps' | 'customPrices'>> = {},
): CostSnapshot {
  return {
    version: COST_STORAGE_VERSION,
    sessionId: newSessionId(now),
    sessionStartedAt: now.getTime(),
    sessionTotal: 0,
    sessionPromptTokens: 0,
    sessionCompletionTokens: 0,
    dayKey: localDayKey(now),
    dailyTotal: 0,
    dailyPromptTokens: 0,
    dailyCompletionTokens: 0,
    messages: {},
    byModel: {},
    caps: extras.caps ?? { session: DEFAULT_SESSION_CAP, daily: DEFAULT_DAILY_CAP },
    customPrices: extras.customPrices ?? {},
    warned80Session: false,
    warned80Daily: false,
  };
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, T>;
}

function sanitizeCaps(value: unknown): CostSnapshot['caps'] {
  const record = asRecord<unknown>(value);
  const session = asNumber(record.session, DEFAULT_SESSION_CAP);
  const daily = asNumber(record.daily, DEFAULT_DAILY_CAP);

  return {
    session: session < 0 ? DEFAULT_SESSION_CAP : session,
    daily: daily < 0 ? DEFAULT_DAILY_CAP : daily,
  };
}

function sanitizeCustomPrices(value: unknown): Record<string, CustomModelPriceRecord> {
  const result: Record<string, CustomModelPriceRecord> = {};

  for (const [model, price] of Object.entries(asRecord<unknown>(value))) {
    if (!price || typeof price !== 'object') {
      continue;
    }

    const row = price as Record<string, unknown>;
    const input = asNumber(row.input, Number.NaN);
    const output = asNumber(row.output, Number.NaN);

    if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) {
      continue;
    }

    const cachedInput = asNumber(row.cachedInput, Number.NaN);
    result[model] = {
      input,
      output,
      ...(Number.isFinite(cachedInput) && cachedInput >= 0 ? { cachedInput } : {}),
    };
  }

  return result;
}

function sanitizeMessages(value: unknown): Record<string, MessageCostRecord> {
  const result: Record<string, MessageCostRecord> = {};

  for (const [id, entry] of Object.entries(asRecord<unknown>(value))) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const row = entry as Record<string, unknown>;
    result[id] = {
      dollars: asNumber(row.dollars),
      unknown: Boolean(row.unknown),
      model: typeof row.model === 'string' ? row.model : 'unknown',
      provider: typeof row.provider === 'string' ? row.provider : undefined,
      promptTokens: asNumber(row.promptTokens),
      completionTokens: asNumber(row.completionTokens),
      cachedTokens: asNumber(row.cachedTokens),
      pending: Boolean(row.pending),
    };
  }

  return result;
}

function sanitizeBreakdown(value: unknown): Record<string, ModelBreakdown> {
  const result: Record<string, ModelBreakdown> = {};

  for (const [model, entry] of Object.entries(asRecord<unknown>(value))) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const row = entry as Record<string, unknown>;
    result[model] = {
      dollars: asNumber(row.dollars),
      promptTokens: asNumber(row.promptTokens),
      completionTokens: asNumber(row.completionTokens),
      unknown: Boolean(row.unknown) || undefined,
    };
  }

  return result;
}

export function applyDayRollover(snapshot: CostSnapshot, now: Date): CostSnapshot {
  const today = localDayKey(now);

  if (snapshot.dayKey === today) {
    return snapshot;
  }

  return {
    ...snapshot,
    dayKey: today,
    dailyTotal: 0,
    dailyPromptTokens: 0,
    dailyCompletionTokens: 0,
    warned80Daily: false,
  };
}

export function parseSnapshot(raw: unknown, now: Date): CostSnapshot {
  if (!raw || typeof raw !== 'object') {
    return emptySnapshot(now);
  }

  const record = raw as Record<string, unknown>;
  const caps = sanitizeCaps(record.caps);
  const customPrices = sanitizeCustomPrices(record.customPrices);

  if (record.version !== COST_STORAGE_VERSION) {
    return emptySnapshot(now, { caps, customPrices });
  }

  const sessionId = typeof record.sessionId === 'string' && record.sessionId ? record.sessionId : `s-${now.getTime()}`;

  return applyDayRollover(
    {
      version: COST_STORAGE_VERSION,
      sessionId,
      sessionStartedAt: asNumber(record.sessionStartedAt, now.getTime()),
      sessionTotal: asNumber(record.sessionTotal),
      sessionPromptTokens: asNumber(record.sessionPromptTokens),
      sessionCompletionTokens: asNumber(record.sessionCompletionTokens),
      dayKey: typeof record.dayKey === 'string' ? record.dayKey : localDayKey(now),
      dailyTotal: asNumber(record.dailyTotal),
      dailyPromptTokens: asNumber(record.dailyPromptTokens),
      dailyCompletionTokens: asNumber(record.dailyCompletionTokens),
      messages: sanitizeMessages(record.messages),
      byModel: sanitizeBreakdown(record.byModel),
      caps,
      customPrices,
      warned80Session: Boolean(record.warned80Session),
      warned80Daily: Boolean(record.warned80Daily),
    },
    now,
  );
}

export function loadSnapshot(raw: string | null | undefined, now: Date): CostSnapshot {
  if (!raw) {
    return emptySnapshot(now);
  }

  try {
    return parseSnapshot(JSON.parse(raw), now);
  } catch {
    return emptySnapshot(now);
  }
}

export function readPersistedCost(storage: KeyValueStore | undefined, now: Date): CostSnapshot {
  if (!storage) {
    return emptySnapshot(now);
  }

  try {
    return loadSnapshot(storage.getItem(COST_STORAGE_KEY), now);
  } catch {
    return emptySnapshot(now);
  }
}

export function writePersistedCost(storage: KeyValueStore | undefined, snapshot: CostSnapshot): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(COST_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private-mode failures must not break chat.
  }
}
