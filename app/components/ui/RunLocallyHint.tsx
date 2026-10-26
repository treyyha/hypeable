/**
 * Shown next to custom/local endpoints that the public host refuses.
 */
import { classNames } from '~/utils/classNames';

export function RunLocallyHint({ className }: { className?: string }) {
  return (
    <p data-testid="run-locally-hint" className={classNames('text-xs text-hype-muted', className)}>
      Run Hypeable locally to use custom endpoints.
    </p>
  );
}
