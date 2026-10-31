import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const APP = join(__dirname, '..', '..');
const CATALOGUE_HOSTS = /dustinwloring1988|bolt-marketplace|raw\.githubusercontent\.com\/[^/]+\/bolt-marketplace/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(full);
    }

    return /\.(ts|tsx)$/.test(entry.name) && !/\.(spec|test)\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('v1 plugin catalogue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not keep a GitHub catalogue URL in app source', () => {
    const hits = sourceFiles(APP)
      .map((file) => ({ file, text: readFileSync(file, 'utf8') }))
      .filter(({ text }) => CATALOGUE_HOSTS.test(text))
      .map(({ file }) => file.replace(/\\/g, '/').split('/app/').pop());

    expect(hits).toEqual([]);
  });

  it('never fetches the third-party catalogue repo', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network disabled')));
    vi.stubGlobal('fetch', fetchMock);

    const { loadMarketplace, installFromMarketplace, fetchMarketplaceChangelog } = await import('./service');

    await expect(loadMarketplace()).rejects.toThrow();
    await expect(
      installFromMarketplace(
        {
          commit: 'a'.repeat(40),
          catalog: { schemaVersion: 1, updatedAt: '2026-01-01', plugins: [] },
          plugins: [],
          stale: false,
          fetchedAt: '',
        },
        'x.y',
        {
          version: '1.0.0',
          manifestPath: 'catalog/x.json',
          packagePath: 'plugins/x.zip',
          manifestSha256: 'a',
          packageSha256: 'b',
        },
      ),
    ).rejects.toThrow();
    await expect(
      fetchMarketplaceChangelog(
        {
          commit: 'a'.repeat(40),
          catalog: { schemaVersion: 1, updatedAt: '2026-01-01', plugins: [] },
          plugins: [],
          stale: false,
          fetchedAt: '',
        },
        {
          version: '1.0.0',
          manifestPath: 'catalog/x.json',
          packagePath: 'plugins/x.zip',
          changelogPath: 'catalog/c.md',
          manifestSha256: 'a',
          packageSha256: 'b',
        },
      ),
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
