/**
 * Designed error placeholder. Copy is honest; no fake data.
 */
import { Button } from './Button';
import { classNames } from '~/utils/classNames';

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={classNames(
        'flex flex-col items-center gap-2 rounded-[var(--hype-radius-lg)] border border-hype-danger/30 bg-hype-surface px-4 py-6 text-center',
        className,
      )}
    >
      <span className="i-ph:warning-circle text-2xl text-hype-danger" aria-hidden="true" />
      <p className="text-sm font-medium text-hype-text">{title}</p>
      {description ? <p className="max-w-sm text-xs text-hype-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
