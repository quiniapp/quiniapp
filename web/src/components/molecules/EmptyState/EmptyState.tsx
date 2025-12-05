import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import React from 'react';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: {
    icon: 'w-8 h-8',
    title: 5 as const,
    description: 'xs' as const,
    gap: 'gap-2',
  },
  md: {
    icon: 'w-12 h-12',
    title: 4 as const,
    description: 'sm' as const,
    gap: 'gap-3',
  },
  lg: {
    icon: 'w-16 h-16',
    title: 3 as const,
    description: 'base' as const,
    gap: 'gap-4',
  },
};

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      title,
      description,
      icon: Icon,
      iconClassName,
      action,
      size = 'md',
      className,
    },
    ref
  ) => {
    const config = sizeConfig[size];

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center py-8',
          config.gap,
          className
        )}
      >
        {Icon && (
          <Icon
            className={cn(config.icon, 'text-muted-foreground/50', iconClassName)}
            aria-hidden="true"
          />
        )}
        <div className={cn('flex flex-col items-center', config.gap)}>
          <Heading level={config.title} weight="semibold" align="center">
            {title}
          </Heading>
          {description && (
            <Text size={config.description} color="muted" align="center" className="max-w-md">
              {description}
            </Text>
          )}
        </div>
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
