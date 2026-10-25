/**
 * Designed loading placeholder built on tokens.
 */
import { classNames } from '~/utils/classNames';

export function LoadingState({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={classNames(
        'flex items-center gap-2 rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-surface px-3 py-2 text-sm text-hype-muted',
        className,
      )}
    >
      <span className="i-ph:circle-notch animate-spin text-hype-accent-text" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
