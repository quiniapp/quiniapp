import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Flex } from '@/components/flex';
import { cn } from '@/lib/utils';
import { ReactNode, forwardRef } from 'react';

interface CheckboxWithLabelProps {
  id: string;
  label: string | ReactNode;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  checkboxClassName?: string;
  onClick?: () => void;
  onCheckedChange?: (checked: boolean) => void;
}

export const CheckboxWithLabel = forwardRef<HTMLDivElement, CheckboxWithLabelProps>(
  (
    {
      id,
      label,
      checked,
      disabled,
      className,
      labelClassName,
      checkboxClassName,
      onClick,
      onCheckedChange,
    },
    ref
  ) => {
    const handleContainerClick = () => {
      if (disabled) return;
      if (onClick) {
        onClick();
      } else if (onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    return (
      <Flex
        ref={ref}
        className={cn(
          'items-center gap-2 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        onClick={handleContainerClick}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          id={id}
          className={cn('border-2 border-primary pointer-events-none', checkboxClassName)}
        />
        <Label
          className={cn('text-base cursor-pointer pointer-events-none', disabled && 'cursor-not-allowed', labelClassName)}
        >
          {label}
        </Label>
      </Flex>
    );
  }
);

CheckboxWithLabel.displayName = 'CheckboxWithLabel';
