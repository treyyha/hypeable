import { describe, expect, it } from 'vitest';
import { capLevel } from './caps';
import {
  LEDGER_MAX_ENTRIES,
  LEDGER_STORAGE_KEY,
  aggregateByModel,
  capBadgeLabel,
  capProgress,
  emptyLedger,
  last7Days,
  ledgerToCsv,
  loadLedger,
  monthToDateTotal,
  persistLedgerEntry,
  readLedger,
  upsertLedgerEntry,
  type LedgerEntry,
} from './ledger';

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };

  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    data,
  };
}

function entry(partial: Partial<LedgerEntry> & Pick<LedgerEntry, 'id'>): LedgerEntry {
  return {
    timestamp: 1_700_000_000_000,
    model: 'gpt-4o-mini',
    promptTokens: 100,
    completionTokens: 50,
    dollars: 0.01,
    ...partial,
  };
}

describe('spend ledger', () => {
  it('falls back to an empty list when storage is missing', () => {
    expect(loadLedger(null).entries).toEqual([]);
  });

  it('falls back to an empty list when storage is corrupted JSON', () => {
    expect(loadLedger('{not json').entries).toEqual([]);
  });

  it('falls back to an empty list when the payload is the wrong shape', () => {
    expect(loadLedger(JSON.stringify({ version: 1, entries: 'nope' })).entries).toEqual([]);
    expect(loadLedger(JSON.stringify({ version: 99, entries: [{ id: 'x' }] })).entries).toEqual([]);
  });

  it('survives a throwing storage getItem', () => {
    const snapshot = readLedger({
      getItem() {
        throw new Error('quota');
      },
      setItem() {
        throw new Error('quota');
      },
    });

    expect(snapshot.entries).toEqual([]);
  });

  it('round-trips a versioned payload and drops unusable rows', () => {
    const store = memoryStore();
    const first = persistLedgerEntry(store, entry({ id: 'a', dollars: 0.2, chatName: 'Todo' }));
    const second = persistLedgerEntry(store, entry({ id: 'b', dollars: 0.1, model: 'claude-x' }));

    expect(second.entries.map((row) => row.id)).toEqual(['b', 'a']);
    expect(loadLedger(store.getItem(LEDGER_STORAGE_KEY)).entries).toHaveLength(2);
    expect(first.entries[0].chatName).toBe('Todo');
  });

  it('upserts by id and caps at 200 entries', () => {
    let snapshot = emptyLedger();

    for (let index = 0; index < LEDGER_MAX_ENTRIES + 5; index += 1) {
      snapshot = upsertLedgerEntry(snapshot, entry({ id: `e-${index}`, dollars: index }));
    }

    expect(snapshot.entries).toHaveLength(LEDGER_MAX_ENTRIES);
    expect(snapshot.entries[0].id).toBe(`e-${LEDGER_MAX_ENTRIES + 4}`);

    const updated = upsertLedgerEntry(snapshot, entry({ id: 'e-0', dollars: 9.99 }));
    expect(updated.entries).toHaveLength(LEDGER_MAX_ENTRIES);
    expect(updated.entries[0]).toMatchObject({ id: 'e-0', dollars: 9.99 });
    expect(updated.entries.filter((row) => row.id === 'e-0')).toHaveLength(1);
  });
});

describe('spend aggregation', () => {
  const noon = new Date('2026-10-26T12:00:00');

  it('totals per model with share of spend and unverified flags', () => {
    const rows = aggregateByModel([
      entry({ id: '1', model: 'gpt-4o-mini', dollars: 0.75, promptTokens: 1000, completionTokens: 0 }),
      entry({ id: '2', model: 'gpt-4o-mini', dollars: 0.25, promptTokens: 200, completionTokens: 50, verified: false }),
      entry({ id: '3', model: 'claude-x', dollars: 1, provider: 'anthropic', promptTokens: 10, completionTokens: 10 }),
    ]);

    expect(rows[0]).toMatchObject({ model: 'claude-x', dollars: 1, share: 0.5, provider: 'anthropic' });
    expect(rows[1]).toMatchObject({
      model: 'gpt-4o-mini',
      dollars: 1,
      share: 0.5,
      tokens: 1250,
      unverified: true,
    });
  });

  it('buckets the last seven local days including empty and unverified days', () => {
    const entries = [
      entry({ id: 'today', timestamp: noon.getTime(), dollars: 1.5, verified: false }),
      entry({
        id: 'yesterday',
        timestamp: new Date('2026-10-25T18:00:00').getTime(),
        dollars: 0.4,
      }),
      entry({
        id: 'old',
        timestamp: new Date('2026-10-18T12:00:00').getTime(),
        dollars: 9,
      }),
    ];

    const days = last7Days(entries, noon);

    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-10-20');
    expect(days[0].dollars).toBe(0);
    expect(days[5]).toMatchObject({ date: '2026-10-25', dollars: 0.4, unverified: false });
    expect(days[6]).toMatchObject({ date: '2026-10-26', dollars: 1.5, unverified: true });
  });

  it('sums month-to-date from the ledger', () => {
    const entries = [
      entry({ id: 'old', timestamp: new Date('2026-09-30T23:00:00').getTime(), dollars: 5 }),
      entry({ id: 'now', timestamp: noon.getTime(), dollars: 1.25 }),
    ];

    expect(monthToDateTotal(entries, noon)).toBe(1.25);
  });

  it('exports csv without breaking quoted names', () => {
    const csv = ledgerToCsv([entry({ id: '1', chatName: 'Habit, "tracker"', dollars: 0.5 })]);

    expect(csv).toContain('timestamp,chat_id,chat_name,model');
    expect(csv).toContain('"Habit, ""tracker"""');
  });
});

describe('cap badges', () => {
  it('maps cap levels to OK / Warning / Reached', () => {
    expect(capBadgeLabel(capLevel(1, 10))).toBe('OK');
    expect(capBadgeLabel(capLevel(8, 10))).toBe('Warning');
    expect(capBadgeLabel(capLevel(10, 10))).toBe('Reached');
    expect(capProgress(8, 10)).toEqual({ ratio: 80, level: 'warn', off: false });
    expect(capProgress(0, 0).off).toBe(true);
  });
});
