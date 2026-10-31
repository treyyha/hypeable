/**
 * Compact token-backed chip for filters, estimates, and suggestion pills.
 * Colours live on `.hype-chip` in tokens.scss so they beat the global
 * `button { color: inherit }` reset.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type ChipTone = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  tone?: ChipTone;
  leading?: ReactNode;
};

export function Chip({
  selected = false,
  tone = 'default',
  leading,
  className,
  children,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      data-tone={selected ? 'accent' : tone}
      data-selected={selected ? 'true' : undefined}
      className={classNames('hype-chip', className)}
      {...props}
    >
      {leading}
      {children}
    </button>
  );
}
