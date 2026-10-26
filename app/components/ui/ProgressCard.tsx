/**
 * Adapted from kokonutUI list-03 (MIT, (c) 2025 kokonutUI).
 * https://github.com/kokonut-labs/kokonutui
 * Restyled to Hypeable tokens; no template fonts or logos.
 */
import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { Progress } from './Progress';
import { classNames } from '~/utils/classNames';

export type ProgressStatus = 'ok' | 'warn' | 'hit';

const STATUS_BADGE: Record<ProgressStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  ok: { label: 'OK', variant: 'success' },
  warn: { label: 'Warning', variant: 'warning' },
  hit: { label: 'Reached', variant: 'danger' },
};

type ProgressCardProps = {
  title: string;
  subtitle?: ReactNode;
  value: number;
  status: ProgressStatus;
  amount?: ReactNode;
  className?: string;
};

export function ProgressCard({ title, subtitle, value, status, amount, className }: ProgressCardProps) {
  const badge = STATUS_BADGE[status];

  return (
    <div
      className={classNames(
        'flex flex-col rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface p-4 shadow-[var(--hype-shadow-sm)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-hype-text">{title}</h3>
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
      </div>
      {subtitle ? <p className="mt-1 text-xs text-hype-muted">{subtitle}</p> : null}
      <div className="mt-3 space-y-1.5">
        <Progress
          value={value}
          className={classNames({
            '[&>div]:bg-hype-ok': status === 'ok',
            '[&>div]:bg-hype-warn': status === 'warn',
            '[&>div]:bg-hype-danger': status === 'hit',
          })}
        />
      </div>
      {amount ? <div className="mt-3 text-sm font-medium tabular-nums text-hype-text">{amount}</div> : null}
    </div>
  );
}

export function progressStatusLabel(status: ProgressStatus): string {
  return STATUS_BADGE[status].label;
}
