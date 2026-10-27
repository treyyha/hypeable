import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissFirstRun,
  FIRST_RUN_DISMISSED_KEY,
  readFirstRunDismissed,
  shouldShowFirstRunCard,
  storedKeyCount,
} from './first-run';

describe('first-run card visibility', () => {
  afterEach(() => {
    localStorage.removeItem(FIRST_RUN_DISMISSED_KEY);
    delete document.documentElement.dataset.firstRun;
  });

  it('counts stored keys without treating junk as a map', () => {
    expect(storedKeyCount(null)).toBe(0);
    expect(storedKeyCount('{}')).toBe(0);
    expect(storedKeyCount('{"OpenRouter":"sk-test"}')).toBe(1);
    expect(storedKeyCount('not-json')).toBe(0);
    expect(storedKeyCount('[]')).toBe(0);
  });

  it('shows the card until it is dismissed or a key exists', () => {
    expect(shouldShowFirstRunCard(false)).toBe(true);
    expect(shouldShowFirstRunCard(true)).toBe(false);

    dismissFirstRun();

    expect(readFirstRunDismissed()).toBe(true);
    expect(shouldShowFirstRunCard(false)).toBe(false);
    expect(document.documentElement.dataset.firstRun).toBe('done');
  });
});
