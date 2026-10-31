/**
 * The cost meter is "what this browser has spent". Two tabs share one
 * localStorage snapshot, so a daily cap must count spend from both.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COST_STORAGE_KEY } from '~/lib/cost/persist';

type Listener = (event: { key: string | null }) => void;

function sharedBrowser() {
  const data = new Map<string, string>();
  const listeners = new Set<Listener>();

  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };

  return {
    data,
    localStorage,
    listeners,
    window: {
      localStorage,
      addEventListener: (type: string, fn: Listener) => type === 'storage' && listeners.add(fn),
      removeEventListener: (_type: string, fn: Listener) => listeners.delete(fn),
    },
  };
}

async function openTab(browser: ReturnType<typeof sharedBrowser>) {
  vi.resetModules();
  vi.stubGlobal('window', browser.window);
  vi.stubGlobal('localStorage', browser.localStorage);

  return import('~/lib/stores/cost');
}

function spend(id: string, dollars: number) {
  return { id, model: 'test-model', promptTokens: 10, completionTokens: 10, actualCost: dollars };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('cost meter across tabs', () => {
  it('a daily cap counts spend from every tab', async () => {
    const browser = sharedBrowser();
    const tabA = await openTab(browser);
    tabA.setCostCaps({ session: 0, daily: 10 });

    const tabB = await openTab(browser);

    expect(tabA.recordUsage(spend('a1', 6)).abort).toBe(false);

    const decision = tabB.recordUsage(spend('b1', 6));

    expect(tabB.costStore.get().dailyTotal).toBeCloseTo(12, 6);
    expect(decision.abort).toBe(true);
    expect(JSON.parse(browser.data.get(COST_STORAGE_KEY) ?? '{}').dailyTotal).toBeCloseTo(12, 6);
  });

  it('the pre-send check sees the other tab', async () => {
    const browser = sharedBrowser();
    const tabA = await openTab(browser);
    tabA.setCostCaps({ session: 0, daily: 10 });

    const tabB = await openTab(browser);
    tabA.recordUsage(spend('a1', 10));

    expect(tabB.evaluateOutgoingCost(0.01).blocking).toBe('daily');
  });

  it('a storage event refreshes the other tab without a new request', async () => {
    const browser = sharedBrowser();
    const tabA = await openTab(browser);
    const tabB = await openTab(browser);

    tabA.recordUsage(spend('a1', 3));

    for (const listener of browser.listeners) {
      listener({ key: COST_STORAGE_KEY });
    }

    expect(tabB.costStore.get().dailyTotal).toBeCloseTo(3, 6);
  });

  it('corrupted storage falls back to an empty meter instead of throwing', async () => {
    const browser = sharedBrowser();
    browser.data.set(COST_STORAGE_KEY, '{"version":1,"dailyTotal":"NaN","messages":[]');

    const tab = await openTab(browser);

    expect(tab.costStore.get().dailyTotal).toBe(0);
    expect(() => tab.recordUsage(spend('x', 1))).not.toThrow();
    expect(tab.costStore.get().dailyTotal).toBeCloseTo(1, 6);
  });
});
