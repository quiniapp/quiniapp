import { forwardRef, type HTMLAttributes } from 'react';

interface BoxProps<T = HTMLDivElement> extends HTMLAttributes<T> {
  className?: string;
}

const Box = forwardRef<HTMLDivElement, BoxProps<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`relative ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Box.displayName = 'Box';

export default Box;
