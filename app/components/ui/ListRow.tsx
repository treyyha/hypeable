/**
 * Adapted from kokonutUI list-01 / list-02 (MIT, (c) 2025 kokonutUI).
 * https://github.com/kokonut-labs/kokonutui
 * Restyled to Hypeable tokens; no template fonts or logos.
 */
import type { ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function ListRow({ leading, title, subtitle, trailing, className }: ListRowProps) {
  return (
    <div
      className={classNames(
        'flex items-center gap-3 rounded-[var(--hype-radius-md)] p-2',
        'hover:bg-hype-surface-2',
        'transition-colors duration-[var(--hype-duration-fast)]',
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-hype-text">{title}</div>
        {subtitle ? <div className="truncate text-[11px] text-hype-muted">{subtitle}</div> : null}
      </div>
      {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
    </div>
  );
}

type ListPanelProps = {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  empty?: ReactNode;
};

export function ListPanel({ title, extra, children, footer, className, empty }: ListPanelProps) {
  return (
    <div
      className={classNames(
        'flex h-full flex-col rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface shadow-[var(--hype-shadow-sm)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2">
        <h2 className="text-sm font-semibold text-hype-text">{title}</h2>
        {extra ? <div className="text-xs text-hype-muted">{extra}</div> : null}
      </div>
      <div className="flex-1 space-y-1 p-3 pt-1">{empty ?? children}</div>
      {footer ? <div className="border-t border-hype-border p-2">{footer}</div> : null}
    </div>
  );
}

export function RowAvatar({ label, tone = 'mint' }: { label: string; tone?: 'lime' | 'mint' | 'cyan' }) {
  const initial = (label.trim()[0] || '?').toUpperCase();

  const tones = {
    lime: 'bg-hype-accent/15 text-hype-accent-text',
    mint: 'bg-hype-mint/15 text-hype-mint',
    cyan: 'bg-hype-cyan/15 text-hype-cyan',
  };

  return (
    <div
      className={classNames(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--hype-radius-md)] border border-hype-border text-xs font-semibold',
        tones[tone],
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
