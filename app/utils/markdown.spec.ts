import { describe, expect, it } from 'vitest';
import { allowedHTMLElements } from './markdown';

describe('markdown HTML allowlist', () => {
  it('does not permit script, iframe, or object through rehype-raw', () => {
    expect(allowedHTMLElements).not.toContain('script');
    expect(allowedHTMLElements).not.toContain('iframe');
    expect(allowedHTMLElements).not.toContain('object');
    expect(allowedHTMLElements).not.toContain('embed');
    expect(allowedHTMLElements).not.toContain('link');
    expect(allowedHTMLElements).not.toContain('meta');
  });
});
