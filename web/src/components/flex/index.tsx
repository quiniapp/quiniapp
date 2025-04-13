import { forwardRef, type HTMLAttributes } from 'react';

interface FlexProps<T = HTMLDivElement> extends HTMLAttributes<T> {
  className?: string;
}

const Flex = forwardRef<HTMLDivElement, FlexProps<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`flex ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Flex.displayName = 'Flex';

export default Flex;
