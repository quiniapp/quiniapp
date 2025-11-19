import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Flex } from '@/components/flex';
import { cn } from '@/lib/utils';
import { ReactNode, forwardRef, useRef, useImperativeHandle } from 'react';

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
    const internalRef = useRef<HTMLButtonElement>(null);

    // Expose the internal ref to the parent component
    useImperativeHandle(ref, () => internalRef.current!);

    const handleContainerClick = () => {
      if (disabled) return;
      internalRef.current?.click();
    };

    return (
      <Flex
        className={cn(
          'items-center gap-2 sm:gap-3 md:gap-4 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        onClick={handleContainerClick}
      >
        <RadioGroupItem
          ref={internalRef}
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
