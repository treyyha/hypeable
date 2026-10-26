/**
 * Adapted from kokonutUI list-01 (MIT, (c) 2025 kokonutUI).
 * https://github.com/kokonut-labs/kokonutui
 * Restyled to Hypeable tokens; no template fonts or logos.
 */
import type { ReactNode } from 'react';
import { Card, CardFooter, CardHeader } from './Card';
import { classNames } from '~/utils/classNames';

type StatCardProps = {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, children, footer, aside, className }: StatCardProps) {
  return (
    <Card className={classNames('flex flex-col', className)}>
      <CardHeader className="border-b border-hype-border p-4">
        <div className={aside ? 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between' : undefined}>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-hype-muted">{label}</p>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-hype-text sm:text-3xl">{value}</div>
            {children}
          </div>
          {aside ? <div className="w-full shrink-0 sm:w-56">{aside}</div> : null}
        </div>
      </CardHeader>
      {footer ? <CardFooter className="px-2 pb-2 pt-4">{footer}</CardFooter> : null}
    </Card>
  );
}
