import { atom } from 'nanostores';
import { logStore } from './logs';
import { getThemeMode, normalizeTheme, type Theme } from '~/types/theme';

export type { Theme } from '~/types/theme';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return getThemeMode(themeStore.get()) === 'dark';
}

export const DEFAULT_THEME: Theme = 'dark';

export const themeStore = atom<Theme>(initStore());

function initStore() {
  if (!import.meta.env.SSR) {
    const storedTheme = localStorage.getItem(kTheme);
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

    return normalizeTheme(storedTheme ?? themeAttribute ?? DEFAULT_THEME);
  }

  return DEFAULT_THEME;
}

export function toggleTheme() {
  setTheme(getThemeMode(themeStore.get()) === 'dark' ? 'light' : 'dark');
}

export function setTheme(newTheme: Theme | string) {
  const theme = normalizeTheme(newTheme);

  themeStore.set(theme);

  localStorage.setItem(kTheme, theme);
  localStorage.setItem(`bolt_theme_${getThemeMode(theme)}`, theme);

  const root = document.querySelector('html');
  root?.setAttribute('data-theme', theme);
  root?.setAttribute('data-color-theme', theme);

  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = theme;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    console.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${theme}`);
}

if (!import.meta.env.SSR) {
  // Tests set theme after load; Layout writes themeStore back onto <html>.
  (window as Window & { __hypeableSetTheme?: typeof setTheme }).__hypeableSetTheme = setTheme;
}
