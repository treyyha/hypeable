import type { MouseEvent } from 'react';

interface SendButtonProps {
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const SendButton = ({ isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <button
      type="button"
      aria-label={isStreaming ? 'Stop' : 'Send'}
      title={isStreaming ? 'Stop' : 'Send'}
      disabled={disabled}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hype-accent text-hype-on-accent transition-theme hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring disabled:cursor-not-allowed disabled:opacity-50"
      onClick={(event) => {
        event.preventDefault();

        if (!disabled) {
          onClick?.(event);
        }
      }}
    >
      <span className={isStreaming ? 'i-ph:stop-circle-bold text-lg' : 'i-ph:arrow-up-bold text-lg'} />
    </button>
  );
};
