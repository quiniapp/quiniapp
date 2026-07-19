import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const Calendar = lazy(() =>
  import('@/components/ui/calendar').then((m) => ({ default: m.Calendar }))
);
import { cn } from '@/lib/utils';

interface SelectDayToSearchProps {
  selectedDay?: string;
  onDayChange: (date?: string) => void;
  className?: string;
  toDate?: Date;
}

export function SelectDayToSearch({
  selectedDay,
  onDayChange,
  className,
  toDate = dayjs().toDate(),
}: SelectDayToSearchProps) {
  // Maintain internal Date state synced with selectedDay prop
  const [date, setDate] = useState<Date | undefined>(
    selectedDay ? dayjs(selectedDay).toDate() : undefined
  );

  // Sync when selectedDay prop changes
  useEffect(() => {
    setDate(selectedDay ? dayjs(selectedDay).toDate() : undefined);
  }, [selectedDay]);

  const handleSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    // Format to local date string without timezone offset
    onDayChange(newDate ? dayjs(newDate).format('YYYY-MM-DD') : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-auto flex items-center gap-1 md:gap-2 justify-center px-2 py-1 lg:px-4 lg:py-2 cursor-pointer',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon color="white" className="h-2 w-2  lg:h-4 lg:w-4 flex-shrink-0" />
          <span className="truncate text-white font-semibold  text-xs md:text-sm lg:text-base text-nowrap">
            {date ? (
              // Show shorter format on mobile
              <span className="hidden sm:inline">{dayjs(date).locale('es').format('D [de] MMMM [de] YYYY')}</span>
            ) : null}
            {date ? (
              <span className="inline sm:hidden">{dayjs(date).format('DD/MM/YY')}</span>
            ) : (
              <span className="">
                <span className="hidden sm:inline">Seleccionar Fecha</span>
                <span className="inline sm:hidden">Fecha</span>
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" collisionPadding={8}>
        <Suspense fallback={null}>
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={handleSelect}
            locale={es}
            toDate={toDate}
            weekStartsOn={0}
            initialFocus
            className={cn('p-2 sm:p-3 pointer-events-auto')}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
