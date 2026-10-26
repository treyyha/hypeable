import { describe, expect, it } from 'vitest';
import { findingHoldsSecret, maskSecret, maskSnippet } from './mask';

describe('predeploy mask', () => {
  it('keeps only the first four characters', () => {
    expect(maskSecret('abcdEFGH')).toBe('abcd***');
    expect(maskSecret('ab')).toBe('****');
  });

  it('replaces every match in a snippet so the full secret is gone', () => {
    const secret = `sk-ant-${'z'.repeat(24)}`;
    const snippet = maskSnippet(`const key = "${secret}";`, [secret]);

    expect(snippet).not.toContain(secret);
    expect(snippet).toContain('sk-a***');
    expect(findingHoldsSecret({ maskedSnippet: snippet }, secret)).toBe(false);
  });
});
