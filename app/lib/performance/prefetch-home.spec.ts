import { describe, expect, it } from 'vitest';
import { scheduleHomePrefetch } from './prefetch-home';

describe('prefetch-home', () => {
  it('returns a cancel function', () => {
    const cancel = scheduleHomePrefetch();
    expect(typeof cancel).toBe('function');
    cancel();
  });
});
