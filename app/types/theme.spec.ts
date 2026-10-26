import { describe, expect, it } from 'vitest';
import { getThemeMode, normalizeTheme, THEMES } from './theme';

describe('theme palettes', () => {
  it('exposes only light and dark', () => {
    expect(THEMES.map((theme) => theme.id)).toEqual(['light', 'dark']);
  });

  it('maps leftover palette ids onto light or dark', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('dark-nord')).toBe('dark');
    expect(normalizeTheme('light-solarized')).toBe('light');
    expect(normalizeTheme(null)).toBe('dark');
    expect(getThemeMode('dark-dracula')).toBe('dark');
    expect(getThemeMode('light-nord')).toBe('light');
  });
});
