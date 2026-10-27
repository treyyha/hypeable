import { describe, expect, it } from 'vitest';
import { COST_STORAGE_KEY, emptySnapshot, loadSnapshot, readPersistedCost, writePersistedCost } from './persist';

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

describe('cost persistence', () => {
  const noon = new Date('2026-10-25T12:00:00');

  it('falls back to zeros when storage is missing', () => {
    const snapshot = loadSnapshot(null, noon);
    expect(snapshot.sessionTotal).toBe(0);
    expect(snapshot.dailyTotal).toBe(0);
    expect(snapshot.caps).toEqual({ session: 2, daily: 10 });
  });

  it('falls back to zeros when storage is corrupted JSON', () => {
    const snapshot = loadSnapshot('{not json', noon);
    expect(snapshot.sessionTotal).toBe(0);
    expect(snapshot.messages).toEqual({});
  });

  it('falls back to zeros when the payload is the wrong shape', () => {
    const snapshot = loadSnapshot(JSON.stringify({ version: 1, sessionTotal: 'lots' }), noon);
    expect(snapshot.sessionTotal).toBe(0);
  });

  it('rolls daily totals over at local midnight and keeps the session', () => {
    const yesterday = emptySnapshot(new Date('2026-10-24T23:00:00'));
    yesterday.sessionTotal = 1.25;
    yesterday.dailyTotal = 4;
    yesterday.warned80Daily = true;

    const rolled = loadSnapshot(JSON.stringify(yesterday), noon);
    expect(rolled.sessionTotal).toBe(1.25);
    expect(rolled.dailyTotal).toBe(0);
    expect(rolled.dayKey).toBe('2026-10-25');
    expect(rolled.warned80Daily).toBe(false);
  });

  it('survives a throwing storage getItem', () => {
    const snapshot = readPersistedCost(
      {
        getItem() {
          throw new Error('quota');
        },
        setItem() {
          throw new Error('quota');
        },
      },
      noon,
    );
    expect(snapshot.sessionTotal).toBe(0);
  });

  it('writes a versioned payload that round-trips', () => {
    const store = memoryStore();
    const snapshot = emptySnapshot(noon);
    snapshot.sessionTotal = 0.043;
    writePersistedCost(store, snapshot);

    const raw = store.getItem(COST_STORAGE_KEY);
    expect(raw).toContain('"version":1');
    expect(loadSnapshot(raw, noon).sessionTotal).toBe(0.043);
  });

  it('keeps nano-dollar totals on messages and byModel after reload', () => {
    const snapshot = emptySnapshot(noon);
    snapshot.sessionTotalNanos = 6;
    snapshot.sessionTotal = 0;
    snapshot.messages.m1 = {
      dollars: 0,
      nanos: 6,
      unknown: false,
      model: 'gpt-4o-mini',
      promptTokens: 1,
      completionTokens: 0,
      cachedTokens: 0,
    };
    snapshot.byModel['gpt-4o-mini'] = {
      dollars: 0,
      nanos: 6,
      promptTokens: 1,
      completionTokens: 0,
    };

    const loaded = loadSnapshot(JSON.stringify(snapshot), noon);
    expect(loaded.sessionTotalNanos).toBe(6);
    expect(loaded.messages.m1.nanos).toBe(6);
    expect(loaded.byModel['gpt-4o-mini']?.nanos).toBe(6);
  });
});
