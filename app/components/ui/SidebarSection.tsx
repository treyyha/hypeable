/**
 * Adapted from kokonutUI sidebar section labels (MIT, (c) 2025 kokonutUI).
 * https://github.com/kokonut-labs/kokonutui
 * Restyled to Hypeable tokens; no template fonts or logos.
 */
import type { ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type SidebarSectionProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

export function SidebarSection({ label, children, className }: SidebarSectionProps) {
  return (
    <div className={classNames('space-y-1', className)}>
      {label ? (
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
