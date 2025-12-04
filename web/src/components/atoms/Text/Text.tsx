import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

const textVariants = cva('', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
      '5xl': 'text-5xl',
    },
    weight: {
      light: 'font-light',
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
      extrabold: 'font-extrabold',
    },
    color: {
      default: 'text-foreground',
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      muted: 'text-muted-foreground',
      white: 'text-white',
      error: 'text-destructive',
      success: 'text-emerald-600',
      warning: 'text-yellow-500',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
    transform: {
      none: 'normal-case',
      uppercase: 'uppercase',
      lowercase: 'lowercase',
      capitalize: 'capitalize',
    },
    truncate: {
      true: 'truncate',
      false: '',
    },
    responsive: {
      'xs-base': 'text-xs md:text-sm lg:text-base',
      'sm-lg': 'text-sm md:text-base lg:text-lg',
      'xs-xl': 'text-xs sm:text-base xl:text-lg 2xl:text-xl',
      false: '',
    },
  },
  defaultVariants: {
    size: 'base',
    weight: 'normal',
    color: 'default',
    align: 'left',
    transform: 'none',
    truncate: false,
    responsive: false,
  },
});

export interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'>,
    VariantProps<typeof textVariants> {
  as?: 'p' | 'span' | 'div' | 'label';
  children: React.ReactNode;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      as: Component = 'p',
      size,
      weight,
      color,
      align,
      transform,
      truncate,
      responsive,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref as any}
        className={cn(
          textVariants({ size, weight, color, align, transform, truncate, responsive }),
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Text.displayName = 'Text';
