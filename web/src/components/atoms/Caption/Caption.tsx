import React from 'react';
import { Text, type TextProps } from '../Text';

export interface CaptionProps extends Omit<TextProps, 'size' | 'color'> {
  children: React.ReactNode;
  size?: 'xs' | 'sm';
  color?: 'muted' | 'default' | 'secondary' | 'primary' | 'white' | 'error' | 'success' | 'warning';
}

export const Caption = React.forwardRef<HTMLElement, CaptionProps>(
  ({ children, size = 'xs', color = 'muted', as = 'span', ...props }, ref) => {
    return (
      <Text ref={ref} as={as} size={size} color={color} {...props}>
        {children}
      </Text>
    );
  }
);

Caption.displayName = 'Caption';
