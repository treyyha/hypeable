import * as React from 'react';
import { classNames } from '~/utils/classNames';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    role="progressbar"
    aria-label={props['aria-label'] ?? 'Progress'}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(value || 0)}
    className={classNames(
      'relative h-1.5 w-full overflow-hidden rounded-full border border-hype-border bg-hype-surface-2',
      className,
    )}
    {...props}
  >
    <div
      className="h-full rounded-full bg-hype-ok transition-[width] duration-[var(--hype-duration-med)]"
      style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
    />
  </div>
));
Progress.displayName = 'Progress';

export { Progress };
