/**
 * Compact local spend ledger. Last 200 settled usages in this browser.
 * Missing or corrupted payloads fall back to an empty list.
 */
import { capLevel, type CapLevel } from './caps';
import type { KeyValueStore } from './persist';

export const LEDGER_STORAGE_KEY = 'hypeable:spend-ledger:v1';
export const LEDGER_STORAGE_VERSION = 1;
export const LEDGER_MAX_ENTRIES = 200;

export type LedgerEntry = {
  id: string;
  timestamp: number;
  chatId?: string;
  chatName?: string;
  model: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  dollars: number;
  verified?: boolean;
};

export type LedgerSnapshot = {
  version: typeof LEDGER_STORAGE_VERSION;
  entries: LedgerEntry[];
};

export type ModelSpendRow = {
  model: string;
  provider?: string;
  dollars: number;
  tokens: number;
  share: number;
  unverified: boolean;
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeEntry(value: unknown): LedgerEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' && row.id ? row.id : '';

  if (!id) {
    return null;
  }

  return {
    id,
    timestamp: asNumber(row.timestamp),
    chatId: typeof row.chatId === 'string' ? row.chatId : undefined,
    chatName: typeof row.chatName === 'string' ? row.chatName : undefined,
    model: typeof row.model === 'string' && row.model ? row.model : 'unknown',
    provider: typeof row.provider === 'string' ? row.provider : undefined,
    promptTokens: Math.max(0, asNumber(row.promptTokens)),
    completionTokens: Math.max(0, asNumber(row.completionTokens)),
    dollars: asNumber(row.dollars),
    verified: row.verified === false ? false : row.verified === true ? true : undefined,
  };
}

export function emptyLedger(): LedgerSnapshot {
  return { version: LEDGER_STORAGE_VERSION, entries: [] };
}

export function parseLedger(raw: unknown): LedgerSnapshot {
  if (!raw || typeof raw !== 'object') {
    return emptyLedger();
  }

  const record = raw as Record<string, unknown>;

  if (record.version !== LEDGER_STORAGE_VERSION) {
    return emptyLedger();
  }

  const entries: LedgerEntry[] = [];

  if (Array.isArray(record.entries)) {
    for (const item of record.entries) {
      const entry = sanitizeEntry(item);

      if (entry) {
        entries.push(entry);
      }
    }
  }

  return { version: LEDGER_STORAGE_VERSION, entries: entries.slice(0, LEDGER_MAX_ENTRIES) };
}

export function loadLedger(raw: string | null | undefined): LedgerSnapshot {
  if (!raw) {
    return emptyLedger();
  }

  try {
    return parseLedger(JSON.parse(raw));
  } catch {
    return emptyLedger();
  }
}

export function readLedger(storage: KeyValueStore | undefined): LedgerSnapshot {
  if (!storage) {
    return emptyLedger();
  }

  try {
    return loadLedger(storage.getItem(LEDGER_STORAGE_KEY));
  } catch {
    return emptyLedger();
  }
}

export function writeLedger(storage: KeyValueStore | undefined, snapshot: LedgerSnapshot): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private-mode failures must not break chat.
  }
}

export function upsertLedgerEntry(snapshot: LedgerSnapshot, entry: LedgerEntry): LedgerSnapshot {
  const next = snapshot.entries.filter((item) => item.id !== entry.id);

  next.unshift(entry);

  return {
    version: LEDGER_STORAGE_VERSION,
    entries: next.slice(0, LEDGER_MAX_ENTRIES),
  };
}

export function persistLedgerEntry(storage: KeyValueStore | undefined, entry: LedgerEntry): LedgerSnapshot {
  const next = upsertLedgerEntry(readLedger(storage), entry);
  writeLedger(storage, next);

  return next;
}

export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfLocalMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function sumLedgerDollars(entries: LedgerEntry[], fromMs?: number, toMs?: number): number {
  return entries.reduce((sum, entry) => {
    if (fromMs !== undefined && entry.timestamp < fromMs) {
      return sum;
    }

    if (toMs !== undefined && entry.timestamp >= toMs) {
      return sum;
    }

    return sum + entry.dollars;
  }, 0);
}

export function monthToDateTotal(entries: LedgerEntry[], now: Date): number {
  return sumLedgerDollars(entries, startOfLocalMonth(now).getTime());
}

export type DaySpend = {
  /** Local calendar day as YYYY-MM-DD. */
  date: string;

  /** Short weekday label for the axis. */
  label: string;
  dollars: number;
  unverified: boolean;
};

function localDayKeyFromDate(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

/** Seven local calendar days ending on `now`, including empty days. */
export function last7Days(entries: LedgerEntry[], now: Date): DaySpend[] {
  const days: DaySpend[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const start = day.getTime();
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();

    let dollars = 0;
    let unverified = false;

    for (const entry of entries) {
      if (entry.timestamp < start || entry.timestamp >= end) {
        continue;
      }

      dollars += entry.dollars;

      if (entry.verified === false) {
        unverified = true;
      }
    }

    days.push({
      date: localDayKeyFromDate(day),
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      dollars,
      unverified,
    });
  }

  return days;
}

export function aggregateByModel(entries: LedgerEntry[]): ModelSpendRow[] {
  const totals = new Map<string, ModelSpendRow>();

  let dollars = 0;

  for (const entry of entries) {
    dollars += entry.dollars;

    const key = entry.model || 'unknown';

    const current = totals.get(key) ?? {
      model: key,
      provider: entry.provider,
      dollars: 0,
      tokens: 0,
      share: 0,
      unverified: false,
    };

    current.dollars += entry.dollars;
    current.tokens += entry.promptTokens + entry.completionTokens;

    if (entry.verified === false) {
      current.unverified = true;
    }

    if (!current.provider && entry.provider) {
      current.provider = entry.provider;
    }

    totals.set(key, current);
  }

  return [...totals.values()]
    .map((row) => ({
      ...row,
      share: dollars > 0 ? row.dollars / dollars : 0,
    }))
    .sort((a, b) => b.dollars - a.dollars || a.model.localeCompare(b.model));
}

export function capBadgeLabel(level: CapLevel): 'OK' | 'Warning' | 'Reached' {
  if (level === 'hit') {
    return 'Reached';
  }

  if (level === 'warn') {
    return 'Warning';
  }

  return 'OK';
}

export function capProgress(spent: number, cap: number): { ratio: number; level: CapLevel; off: boolean } {
  const off = !(cap > 0);
  const level = capLevel(spent, cap);
  const ratio = off ? 0 : Math.min(100, (spent / cap) * 100);

  return { ratio, level, off };
}

export function ledgerToCsv(entries: LedgerEntry[]): string {
  const header = 'timestamp,chat_id,chat_name,model,provider,prompt_tokens,completion_tokens,cost,verified';

  const rows = entries.map((entry) =>
    [
      new Date(entry.timestamp).toISOString(),
      csvCell(entry.chatId ?? ''),
      csvCell(entry.chatName ?? ''),
      csvCell(entry.model),
      csvCell(entry.provider ?? ''),
      String(entry.promptTokens),
      String(entry.completionTokens),
      entry.dollars.toFixed(6),
      entry.verified === false ? 'false' : entry.verified === true ? 'true' : '',
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
