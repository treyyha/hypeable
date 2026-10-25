import { memo } from 'react';
import { IconButton } from '~/components/ui/IconButton';
interface SettingsButtonProps {
  onClick: () => void;
}

export const SettingsButton = memo(({ onClick }: SettingsButtonProps) => {
  return (
    <IconButton
      onClick={onClick}
      icon="i-ph:gear"
      size="xl"
      title="Preferences"
      data-testid="settings-button"
      className="text-hype-muted hover:text-hype-text hover:bg-hype-surface-2 transition-colors"
    />
  );
});

interface HelpButtonProps {
  onClick: () => void;
}

export const HelpButton = memo(({ onClick }: HelpButtonProps) => {
  return (
    <IconButton
      onClick={onClick}
      icon="i-ph:question"
      size="xl"
      title="Help & Documentation"
      data-testid="help-button"
      className="text-hype-muted hover:text-hype-text hover:bg-hype-surface-2 transition-colors"
    />
  );
});
