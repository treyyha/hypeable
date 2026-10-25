/**
 * Compact token-backed chip for filters, estimates, and suggestion pills.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type ChipTone = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  tone?: ChipTone;
  leading?: ReactNode;
};

const toneClass: Record<ChipTone, string> = {
  default: 'border-hype-border bg-hype-surface text-hype-muted hover:text-hype-text',
  accent: 'border-hype-border bg-[var(--hype-accent-soft)] text-hype-accent-text',
  ok: 'border-hype-border bg-[var(--hype-accent-soft)] text-hype-ok',
  warn: 'border-hype-border text-hype-warn',
  danger: 'border-hype-border text-hype-danger',
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
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring',
        selected ? toneClass.accent : toneClass[tone],
        className,
      )}
      {...props}
    >
      {leading}
      {children}
    </button>
  );
}
