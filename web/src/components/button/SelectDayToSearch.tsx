import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { es } from 'react-day-picker/locale';
import { CalendarIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const Calendar = lazy(() =>
  import('@/components/ui/calendar').then((m) => ({ default: m.Calendar }))
);
import { cn } from '@/lib/utils';

interface SelectDayToSearchProps {
  selectedDay: string;
  onDayChange: (date: string) => void;
  className?: string;
  toDate?: Date;
}

export function SelectDayToSearch({
  selectedDay,
  onDayChange,
  className,
  toDate = dayjs().toDate(),
}: SelectDayToSearchProps) {
  const date = dayjs(selectedDay).toDate();

  // Format to local date string without timezone offset
  const handleSelect = (newDate: Date) => {
    onDayChange(dayjs(newDate).format('YYYY-MM-DD'));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-auto flex items-center gap-1 md:gap-2 justify-center px-2 py-1 lg:px-4 lg:py-2 cursor-pointer',
            className
          )}
        >
          <CalendarIcon color="white" className="h-2 w-2  lg:h-4 lg:w-4 flex-shrink-0" />
          <span className="truncate text-white font-semibold  text-xs md:text-sm lg:text-base text-nowrap">
            {/* Show shorter format on mobile */}
            <span className="hidden sm:inline">
              {dayjs(date).locale('es').format('D [de] MMMM [de] YYYY')}
            </span>
            <span className="inline sm:hidden">{dayjs(date).format('DD/MM/YY')}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-16px)] p-0"
        align="start"
        collisionPadding={8}
      >
        <Suspense fallback={null}>
          <Calendar
            mode="single"
            required
            selected={date}
            defaultMonth={date}
            onSelect={handleSelect}
            locale={es}
            endMonth={toDate}
            disabled={{ after: toDate }}
            weekStartsOn={0}
            autoFocus
            className={cn('p-2 sm:p-3 pointer-events-auto')}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
