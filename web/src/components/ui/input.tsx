import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, maxLength, ...props }, ref) => {
    return (
      <input
        ref={ref}
      type={type}
      data-slot="input"
      maxLength={maxLength}
      className={cn(
        'text-primary file:text-primary-light placeholder:text-primary-ligth selection:bg-primary selection:text-primary-primary dark:bg-input/30 border-input flex h-[36px] w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
    );
  }
);

// (Opcional, pero recomendado)
Input.displayName = 'Input';

export { Input };