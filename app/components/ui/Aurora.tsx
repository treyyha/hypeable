/**
 * Soft CSS-only atmosphere. Use behind the empty home column and empty states only.
 */
import type { HTMLAttributes } from 'react';
import { classNames } from '~/utils/classNames';

type AuroraProps = HTMLAttributes<HTMLDivElement>;

export function Aurora({ className, ...rest }: AuroraProps) {
  return (
    <div className={classNames('hype-aurora', className)} aria-hidden="true" {...rest}>
      <div className="hype-aurora__layer" />
    </div>
  );
}
