/**
 * Soft CSS-only atmosphere. Use behind the home hero/composer and empty states only.
 */
import { classNames } from '~/utils/classNames';

export function Aurora({ className }: { className?: string }) {
  return (
    <div className={classNames('hype-aurora', className)} aria-hidden="true">
      <div className="hype-aurora__layer" />
    </div>
  );
}
