export const THEMES = [
  { id: 'light', name: 'Light', mode: 'light', colors: ['#FAFAF7', '#FFFFFF', '#C8FF3D'] },
  { id: 'dark', name: 'Hypeable', mode: 'dark', colors: ['#0A0A0F', '#111118', '#C8FF3D'] },
] as const;

export type Theme = (typeof THEMES)[number]['id'];
export type ThemeMode = 'light' | 'dark';

export function normalizeTheme(value: string | null | undefined): Theme {
  if (value === 'light' || value === 'dark') {
    return value;
  }

  if (typeof value === 'string' && (value.startsWith('light') || value === 'light')) {
    return 'light';
  }

  return 'dark';
}

export function getThemeMode(theme: Theme | string): ThemeMode {
  return normalizeTheme(theme);
}
