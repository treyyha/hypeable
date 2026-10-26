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
  className?: string;
};

export function StatCard({ label, value, children, footer, className }: StatCardProps) {
  return (
    <Card className={classNames('flex flex-col', className)}>
      <CardHeader className="border-b border-hype-border p-4">
        <p className="text-xs text-hype-muted">{label}</p>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-hype-text sm:text-3xl">{value}</div>
        {children}
      </CardHeader>
      {footer ? <CardFooter className="p-2">{footer}</CardFooter> : null}
    </Card>
  );
}
