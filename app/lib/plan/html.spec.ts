import { describe, expect, it } from 'vitest';
import { asPlainText } from './html';

describe('asPlainText', () => {
  it('strips tags so HTML in plan text stays inert', () => {
    expect(asPlainText('<img src=x onerror="alert(1)">hi')).toBe('hi');
    expect(asPlainText('safe <b>bold</b> text')).toBe('safe bold text');
    expect(asPlainText('no tags')).toBe('no tags');
  });
});
