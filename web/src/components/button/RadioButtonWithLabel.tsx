import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Flex } from '@/components/flex';
import { cn } from '@/lib/utils';
import { ReactNode, forwardRef } from 'react';

interface RadioButtonWithLabelProps {
  id: string;
  value: string;
  label: string | ReactNode;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  radioClassName?: string;
}

export const RadioButtonWithLabel = forwardRef<HTMLButtonElement, RadioButtonWithLabelProps>(
  ({ id, value, label, disabled, className, labelClassName, radioClassName }, ref) => {
    return (
      <Flex
        className={cn(
          'items-center gap-2 sm:gap-3 md:gap-4 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <RadioGroupItem
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          className={cn('border-2 border-primary', radioClassName)}
        />
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            labelClassName
          )}
        >
          {label}
        </Label>
      </Flex>
    );
  }
);

RadioButtonWithLabel.displayName = 'RadioButtonWithLabel';
