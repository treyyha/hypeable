import { useStore } from '@nanostores/react';
import { memo, useEffect, useState } from 'react';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { getThemeMode } from '~/types/theme';
import { classNames } from '~/utils/classNames';

interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch = memo(({ className }: ThemeSwitchProps) => {
  const theme = useStore(themeStore);
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  if (!domLoaded) {
    return null;
  }

  return (
    <button
      type="button"
      className={classNames('hype-icon-btn', className)}
      title="Toggle Theme"
      aria-label="Toggle Theme"
      onClick={toggleTheme}
    >
      <span
        className={getThemeMode(theme) === 'dark' ? 'i-ph-sun-dim-duotone text-xl' : 'i-ph-moon-stars-duotone text-xl'}
      />
    </button>
  );
});
