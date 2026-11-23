import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker, getDefaultClassNames, type ChevronProps } from 'react-day-picker';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A nivel de módulo para no recrear el componente en cada render. `size` y `disabled`
// no se pasan al <svg>.
function CalendarChevron({
  className,
  orientation,
  size: _size,
  disabled: _disabled,
  ...props
}: ChevronProps) {
  const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
  return <Icon className={cn('size-4', className)} {...props} />;
}

function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();
  const navButton = cn(
    buttonVariants({ variant: 'outline' }),
    'size-8 sm:size-7 bg-transparent p-0 opacity-50 hover:opacity-100 aria-disabled:pointer-events-none aria-disabled:opacity-25'
  );

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        // En v9+ el <nav> es el primer hijo de .months (ya no está dentro del caption):
        // se superpone a la fila del caption.
        nav: 'absolute inset-x-0 top-0 flex h-9 sm:h-8 items-center justify-between px-1 pt-1',
        button_previous: navButton,
        button_next: navButton,
        month_caption: 'flex h-9 sm:h-8 items-center justify-center pt-1 w-full',
        caption_label: 'text-base sm:text-sm font-medium capitalize',
        month_grid: 'w-full border-collapse space-x-1',
        weekdays: 'flex justify-around',
        weekday: 'text-muted-foreground rounded-md w-9 sm:w-8 font-normal text-sm sm:text-[0.8rem]',
        week: 'flex w-full mt-2',
        // `day` es el <td>, y `aria-selected` y los modificadores ahora van en el <td>.
        day: cn(
          'relative p-0 text-center text-base sm:text-sm focus-within:relative focus-within:z-20 aria-selected:bg-accent',
          props.mode === 'range'
            ? 'first:aria-selected:rounded-l-md last:aria-selected:rounded-r-md'
            : 'aria-selected:rounded-md'
        ),
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'size-9 sm:size-8 p-0 font-normal'),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside: 'text-muted-foreground [&>button]:text-muted-foreground',
        disabled: '[&>button]:text-muted-foreground [&>button]:opacity-50',
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        range_middle: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
        // `rdp-root` siempre: la excepción a los estilos globales de tablas
        // (styles/index.css) se engancha de esa clase.
        root: cn(defaults.root, classNames?.root),
      }}
      components={{ Chevron: CalendarChevron, ...components }}
      {...props}
    />
  );
}

export { Calendar };
