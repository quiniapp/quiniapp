import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const IconButton = ({
  label,
  icon,
  onClick,
  disabled,
  variant = 'default',
  className,
  type = 'button',
}: IconButtonProps) => {
  return (
    <Button
      type={type}
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className={cn('w-full sm:w-auto flex items-center gap-2 justify-center px-2 py-1 sm:px-4 sm:py-2', className)}
    >
      {icon && <span className="hidden md:inline flex-shrink-0">{icon}</span>}
      <span className="truncate text-xs sm:text-sm md:text-base text-nowrap">{label}</span>
    </Button>
  );
};
