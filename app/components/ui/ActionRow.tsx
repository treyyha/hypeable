/**
 * Adapted from kokonutUI list-01 action footer (MIT, (c) 2025 kokonutUI).
 * https://github.com/kokonut-labs/kokonutui
 * Restyled to Hypeable tokens; no template fonts or logos.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type ActionRowProps = {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
};

export function ActionRow({ children, className, columns = 3 }: ActionRowProps) {
  return (
    <div
      className={classNames('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  children: ReactNode;
  tone?: 'accent' | 'ghost';
};

export function ActionButton({ icon, children, className, tone = 'ghost', ...rest }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={classNames(
        'inline-flex items-center justify-center gap-1.5 rounded-[var(--hype-radius-md)] px-3 py-2 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring',
        tone === 'accent'
          ? 'bg-hype-accent text-hype-on-accent hover:opacity-90'
          : 'border border-hype-border bg-hype-surface-2 text-hype-text hover:bg-hype-border',
        className,
      )}
      {...rest}
    >
      {icon ? <span className={classNames(icon, 'h-3.5 w-3.5')} /> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}
