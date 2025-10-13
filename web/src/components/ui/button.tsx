import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: sin altura/padding fijos
  "inline-flex hover:cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive \
  [&_svg:not([class*='size-'])]:size-3 sm:[&_svg:not([class*='size-'])]:size-4", // 👈 SVG responsive
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        success: 'bg-emerald-600',
        destructive:
          'bg-red-700 text-white shadow-xs hover:bg-destructive/30 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/90',
        outline:
          'border text-white border-primary shadow-xs hover:text-primary dark:bg-input/30 dark:border-primary dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // móvil compacto, sube en sm:
        default:
          'h-8 px-3 text-[11px] has-[>svg]:px-2.5 sm:h-9 sm:px-4 sm:text-xs sm:has-[>svg]:px-3',
        sm: 'h-7 px-2.5 text-[10px] has-[>svg]:px-2 sm:h-8 sm:px-3 sm:text-[11px]',
        lg: 'h-9 px-3.5 text-xs sm:h-10 sm:px-6',
        icon: 'size-7 sm:size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// 👇 Acá usamos forwardRef para pasar refs correctamente
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
