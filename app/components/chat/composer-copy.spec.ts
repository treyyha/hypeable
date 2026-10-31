import { describe, expect, it } from 'vitest';
import {
  COMPOSER_SHORTCUT_HINT,
  composerPlaceholder,
  DISCUSS_PLACEHOLDER,
  FIRST_BUILD_PLACEHOLDER,
  planEstimateCopy,
} from './composer-copy';

describe('composer copy', () => {
  it('uses the first-build placeholder unless discuss mode is explicit', () => {
    expect(composerPlaceholder(undefined)).toBe(FIRST_BUILD_PLACEHOLDER);
    expect(composerPlaceholder('build')).toBe(FIRST_BUILD_PLACEHOLDER);
    expect(composerPlaceholder('discuss')).toBe(DISCUSS_PLACEHOLDER);
  });

  it('keeps the keyboard hint as a single outside-the-card line', () => {
    expect(COMPOSER_SHORTCUT_HINT).toContain('Enter to send');
    expect(COMPOSER_SHORTCUT_HINT).toContain('Shift+Enter');
  });

  it('shows a short unknown-price chip instead of a set-a-price prompt', () => {
    expect(planEstimateCopy(true, '$0.12')).toEqual({
      text: 'price unknown',
      title: 'No list price for this model. Set a custom price in Settings to estimate.',
    });
    expect(planEstimateCopy(false, '$0.12')).toEqual({
      text: 'about $0.12',
      title: 'Estimated planning cost $0.12',
    });
  });
});
