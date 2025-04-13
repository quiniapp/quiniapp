'use client';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { CalendarIcon } from 'lucide-react';

export function Calendar({
  className,
  value,
  onChange,
}: {
  className?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
}) {
  return (
    <div className={cn('relative', className)}>
      <DatePicker
        selected={value}
        onChange={onChange}
        dateFormat="dd/MM/yyyy"
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          className
        )}
        calendarClassName="bg-popover rounded-md p-2 shadow-md border mt-2"
        dayClassName={(date) =>
          cn(
            buttonVariants({ variant: 'ghost' }),
            'w-10 h-10 p-0 text-sm rounded-md',
            'hover:bg-accent hover:text-accent-foreground',
            value?.toDateString() === date.toDateString()
              ? 'bg-primary text-primary-foreground'
              : ''
          )
        }
        popperPlacement="bottom-start"
        showPopperArrow={false}
      />
      <CalendarIcon className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}
