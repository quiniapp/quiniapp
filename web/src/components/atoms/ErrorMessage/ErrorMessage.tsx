import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import React from 'react';
import { Text, type TextProps } from '../Text';

export interface ErrorMessageProps extends Omit<TextProps, 'color' | 'as'> {
  children: React.ReactNode;
  showIcon?: boolean;
  iconClassName?: string;
}

export const ErrorMessage = React.forwardRef<HTMLParagraphElement, ErrorMessageProps>(
  ({ children, showIcon = true, iconClassName, className, size = 'sm', ...props }, ref) => {
    return (
      <div className={cn('flex items-start gap-1.5', className)} role="alert" aria-live="polite">
        {showIcon && (
          <AlertCircle
            className={cn('w-4 h-4 text-destructive flex-shrink-0 mt-0.5', iconClassName)}
            aria-hidden="true"
          />
        )}
        <Text
          ref={ref}
          as="span"
          size={size}
          color="error"
          className="flex-1"
          {...props}
        >
          {children}
        </Text>
      </div>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';
