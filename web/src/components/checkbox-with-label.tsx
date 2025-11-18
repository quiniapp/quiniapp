import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Flex } from '@/components/flex';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

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

export const CheckboxWithLabel = ({
  id,
  label,
  checked,
  disabled,
  className,
  labelClassName,
  checkboxClassName,
  onClick,
  onCheckedChange,
}: CheckboxWithLabelProps) => {
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
        onCheckedChange={onCheckedChange}
      />
      <Label
        htmlFor={id}
        className={cn('text-base cursor-pointer', disabled && 'cursor-not-allowed', labelClassName)}
      >
        {label}
      </Label>
    </Flex>
  );
};
