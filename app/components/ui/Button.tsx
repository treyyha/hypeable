import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--hype-radius-md)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring focus-visible:ring-offset-2 focus-visible:ring-offset-hype-bg disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-hype-accent text-hype-on-accent hover:opacity-90',
        primary: 'bg-hype-accent text-hype-on-accent hover:opacity-90',
        destructive: 'bg-hype-danger text-white hover:opacity-90',
        danger: 'bg-hype-danger text-white hover:opacity-90',
        outline: 'border border-hype-border bg-transparent text-hype-text hover:bg-hype-surface-2',
        secondary: 'bg-hype-surface-2 text-hype-text hover:bg-hype-border',
        ghost: 'bg-transparent text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text',
        link: 'text-hype-accent-text underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-[var(--hype-radius-sm)] px-3 text-xs',
        lg: 'h-10 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
