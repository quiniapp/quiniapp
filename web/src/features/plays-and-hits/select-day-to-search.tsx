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
  toDate?:Date
}

export function SelectDayToSearch({ selectedDay, onDayChange, className,toDate }: SelectDayToSearchProps) {
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
            'sm:w-[240px] justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon  color='white' className="mr-2 h-4 w-4" />
          {date ? dayjs(date).locale('es').format('D [de] MMMM [de] YYYY') : <span className='text-white font-semibold'>Seleccionar Fecha</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Suspense fallback={null}>
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={es}
            toDate={toDate}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
