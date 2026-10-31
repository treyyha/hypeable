import * as SwitchPrimitive from '@radix-ui/react-switch';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';

interface SwitchProps {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (event: boolean) => void;
  'aria-label'?: string;
  id?: string;
  disabled?: boolean;
}

export const Switch = memo(
  ({ className, onCheckedChange, checked, 'aria-label': ariaLabel, id, disabled }: SwitchProps) => {
    return (
      <SwitchPrimitive.Root
        className={classNames('hype-switch', className)}
        checked={checked}
        onCheckedChange={(e) => onCheckedChange?.(e)}
        aria-label={ariaLabel}
        id={id}
        disabled={disabled}
      >
        <SwitchPrimitive.Thumb className="hype-switch__thumb" />
      </SwitchPrimitive.Root>
    );
  },
);
