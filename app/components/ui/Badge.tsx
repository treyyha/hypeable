import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { classNames } from '~/utils/classNames';

const badgeVariants = cva(
  'inline-flex items-center gap-1 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-hype-surface-2 text-hype-text',
        secondary: 'border-transparent bg-hype-surface-2 text-hype-muted',
        destructive: 'border-transparent hype-badge-danger',
        outline: 'border-hype-border text-hype-text',
        primary: 'border-transparent bg-hype-accent text-hype-on-accent',
        success: 'border-transparent hype-badge-ok',
        warning: 'border-transparent hype-badge-warn',
        danger: 'border-transparent hype-badge-danger',
        info: 'border-transparent bg-hype-cyan/16 text-hype-cyan',
        subtle: 'border-hype-border bg-hype-surface text-hype-muted',
      },
      size: {
        default: 'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        sm: 'rounded-full px-1.5 py-0.5 text-xs',
        md: 'rounded-[var(--hype-radius-sm)] px-2 py-1 text-xs font-medium',
        lg: 'rounded-[var(--hype-radius-md)] px-2.5 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  icon?: string;
}

function Badge({ className, variant, size, icon, children, ...props }: BadgeProps) {
  return (
    <div className={classNames(badgeVariants({ variant, size }), className)} {...props}>
      {icon && <span className={icon} />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
