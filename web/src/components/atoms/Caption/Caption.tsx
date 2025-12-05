import React from 'react';
import { cn } from '@/lib/utils';
import { Text, type TextProps } from '../Text';

export interface CaptionProps extends Omit<TextProps, 'size' | 'color'> {
  children: React.ReactNode;
  size?: 'xs' | 'sm';
  color?: 'muted' | 'default' | 'secondary' | 'primary' | 'white' | 'error' | 'success' | 'warning';
  variant?: 'default' | 'label';
}

export const Caption = React.forwardRef<HTMLElement, CaptionProps>(
  ({ children, size = 'xs', color = 'muted', variant = 'default', as = 'span', className, ...props }, ref) => {
    const variantStyles = {
      default: '',
      label: 'font-medium text-blue-light-80 tracking-wide',
    };

    return (
      <Text
        ref={ref}
        as={as}
        size={size}
        color={variant === 'label' ? undefined : color}
        className={cn(variantStyles[variant], className)}
        {...props}
      >
        {children}
      </Text>
    );
  }
);

Caption.displayName = 'Caption';
