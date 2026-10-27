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
  const cols =
    columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3';

  return <div className={classNames('grid gap-2', cols, className)}>{children}</div>;
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
        tone === 'accent'
          ? 'inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--hype-radius-md)] bg-hype-accent px-3 py-2 text-xs font-medium text-hype-on-accent hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring'
          : 'hype-action-btn w-full',
        className,
      )}
      {...rest}
    >
      {icon ? <span className={classNames(icon, 'h-3.5 w-3.5 shrink-0')} /> : null}
      <span>{children}</span>
    </button>
  );
}
