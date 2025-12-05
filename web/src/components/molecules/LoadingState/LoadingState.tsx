import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Text } from '@/components/atoms/Text';
import React from 'react';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    spinner: 'w-4 h-4',
    text: 'xs' as const,
    gap: 'gap-1.5',
  },
  md: {
    spinner: 'w-8 h-8',
    text: 'sm' as const,
    gap: 'gap-2',
  },
  lg: {
    spinner: 'w-12 h-12',
    text: 'base' as const,
    gap: 'gap-3',
  },
};

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ message = 'Cargando...', size = 'md', fullScreen = false, className }, ref) => {
    const config = sizeConfig[size];

    const containerClass = fullScreen
      ? 'fixed inset-0 flex items-center justify-center bg-background z-50'
      : 'flex items-center justify-center min-h-[200px]';

    return (
      <div ref={ref} className={cn(containerClass, className)}>
        <div className={cn('flex flex-col items-center', config.gap)}>
          <Loader2 className={cn(config.spinner, 'animate-spin text-primary')} />
          <Text size={config.text} color="muted">
            {message}
          </Text>
        </div>
      </div>
    );
  }
);

LoadingState.displayName = 'LoadingState';
