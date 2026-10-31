import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva('hype-btn', {
  variants: {
    variant: {
      default: 'hype-btn--primary',
      primary: 'hype-btn--primary',
      destructive: 'hype-btn--danger',
      danger: 'hype-btn--danger',
      outline: 'hype-btn--ghost',
      secondary: 'hype-btn--ghost',
      ghost: 'hype-btn--ghost',
      link: 'hype-text-link',
      tint: 'hype-link-btn',
    },
    size: {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-[var(--hype-radius-sm)] px-3 text-xs',
      lg: 'h-10 px-8',
      icon: 'h-9 w-9',
    },
  },
  compoundVariants: [
    { variant: 'link', class: 'h-auto w-auto px-0 py-0' },
    { variant: 'tint', size: 'default', class: 'h-auto' },
  ],
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', _asChild = false, ...props }, ref) => {
    return (
      <button type={type} className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
