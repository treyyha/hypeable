import { memo } from 'react';

interface SettingsButtonProps {
  onClick: () => void;
}

export const SettingsButton = memo(({ onClick }: SettingsButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Preferences"
      aria-label="Preferences"
      data-testid="settings-button"
      className="hype-icon-btn"
    >
      <span className="i-ph:gear text-xl" />
    </button>
  );
});

interface HelpButtonProps {
  onClick: () => void;
}

export const HelpButton = memo(({ onClick }: HelpButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Help & Documentation"
      aria-label="Help & Documentation"
      data-testid="help-button"
      className="hype-icon-btn"
    >
      <span className="i-ph:question text-xl" />
    </button>
  );
});
