import { describe, expect, it, vi } from 'vitest';
import { checkForUpdates } from './updates';

describe('checkForUpdates', () => {
  it('does not fetch GitHub or any other host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkForUpdates();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ available: false, version: 'unknown' });

    vi.unstubAllGlobals();
  });
});
