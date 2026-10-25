import { describe, expect, it } from 'vitest';
import { isDocsOnly, isDocsOnlyPath } from './ci-docs-only.mjs';

describe('docs-only CI filter', () => {
  it('treats markdown, docs/, and assets/ as skippable', () => {
    expect(isDocsOnlyPath('README.md')).toBe(true);
    expect(isDocsOnlyPath('docs/TESTING.md')).toBe(true);
    expect(isDocsOnlyPath('docs/assets/home-dark-1440.png')).toBe(true);
    expect(isDocsOnlyPath('assets/logo.png')).toBe(true);
    expect(isDocsOnlyPath('.github/workflows/ci.yml')).toBe(false);
    expect(isDocsOnlyPath('app/root.tsx')).toBe(false);
  });

  it('is docs-only only when every changed file matches', () => {
    expect(isDocsOnly(['README.md', 'docs/ARCHITECTURE.md'])).toBe(true);
    expect(isDocsOnly(['README.md', 'app/root.tsx'])).toBe(false);
    expect(isDocsOnly([])).toBe(false);
  });
});
