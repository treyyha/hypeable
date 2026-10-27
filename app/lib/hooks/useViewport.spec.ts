import { describe, expect, it } from 'vitest';
import { readIsSmallViewport } from './useViewport';

describe('readIsSmallViewport', () => {
  it('is false when there is no window (SSR)', () => {
    expect(readIsSmallViewport(1024, undefined)).toBe(false);
  });

  it('is true below the threshold', () => {
    expect(readIsSmallViewport(1024, { innerWidth: 390 })).toBe(true);
  });

  it('is false at or above the threshold', () => {
    expect(readIsSmallViewport(1024, { innerWidth: 1024 })).toBe(false);
    expect(readIsSmallViewport(1024, { innerWidth: 1440 })).toBe(false);
  });
});
