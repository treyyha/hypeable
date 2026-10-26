import type { MouseEvent } from 'react';
import { classNames } from '~/utils/classNames';

interface SendButtonProps {
  isStreaming?: boolean;
  disabled?: boolean;
  armed?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const SendButton = ({ isStreaming, disabled, armed, onClick }: SendButtonProps) => {
  return (
    <button
      type="button"
      aria-label={isStreaming ? 'Stop' : 'Send'}
      title={isStreaming ? 'Stop' : 'Send'}
      disabled={disabled}
      className={classNames(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hype-accent text-hype-on-accent transition-opacity hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring disabled:cursor-not-allowed',
        isStreaming || armed ? 'opacity-100' : 'opacity-[0.45]',
      )}
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
