import { forwardRef, type HTMLAttributes } from 'react';

interface FlexProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Flex = forwardRef<HTMLDivElement, FlexProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`flex ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Flex.displayName = 'Flex';

const FlexCol = forwardRef<HTMLDivElement, FlexProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <Flex ref={ref} className={`flex-col ${className}`} {...props}>
        {children}
      </Flex>
    );
  }
);

FlexCol.displayName = 'FlexCol';

export { Flex, FlexCol };
