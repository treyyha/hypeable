import { describe, expect, it } from 'vitest';
import { clampThreshold, DEFAULT_LOOP_SETTINGS, normalizeLoopSettings, readLoopSettings } from './settings';

describe('loop settings', () => {
  it('clamps the threshold to 2–5', () => {
    expect(clampThreshold(1)).toBe(2);
    expect(clampThreshold(3.4)).toBe(3);
    expect(clampThreshold(9)).toBe(5);
    expect(clampThreshold(Number.NaN)).toBe(3);
  });

  it('defaults to enabled with a threshold of 3', () => {
    expect(normalizeLoopSettings(undefined)).toEqual(DEFAULT_LOOP_SETTINGS);
    expect(readLoopSettings('not-json')).toEqual(DEFAULT_LOOP_SETTINGS);
    expect(readLoopSettings('{"enabled":false,"threshold":4}')).toEqual({ enabled: false, threshold: 4 });
  });
});
