import { useState, useMemo, useLayoutEffect, useRef } from 'react';
import { Flex } from '@/components/flex';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useClock } from '@/providers/ClockProvider';
import { USER_TYPE } from '@helper/types/user.type';
import { useAuth } from '@/contexts/AuthContext';

interface SchedulesProps {
  time: string;
  schedule_id: string;
  name: string;
}

interface SchedulesCheckboxListMobileProps {
  schedules: SchedulesProps[];
  setSchedules: (schedule: IScheduleEntityFront) => void;
  checkedSchedules: Map<string, IScheduleEntityFront>;
}

const SchedulesCheckboxListMobile = ({
  schedules,
  setSchedules,
  checkedSchedules,
}: SchedulesCheckboxListMobileProps) => {
  const { role } = useAuth();
  const { isScheduleAfter, isLessThanTenMinutes } = useClock();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerW, setTriggerW] = useState(0);

  useLayoutEffect(() => {
    const update = () => setTriggerW(triggerRef.current?.offsetWidth ?? 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const selectedCount = checkedSchedules.size;
  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return 'Seleccionar turnos';
    if (selectedCount === 1) return `${Array.from(checkedSchedules.values())[0].name}`;
    return `${selectedCount} seleccionados`;
  }, [selectedCount, checkedSchedules]);

  const isEnabled = (t: string) =>
    (isScheduleAfter(t) && !isLessThanTenMinutes(t)) || role !== USER_TYPE.CASHIER;

  const toggleSchedule = (sch: IScheduleEntityFront) => {
    if (!isEnabled(sch.time)) return;
    setSchedules(sch);
  };

  const clearAll = () => {
    Array.from(checkedSchedules.values()).forEach(setSchedules);
  };

  // Calcular turnos disponibles (habilitados)
  const availableSchedules = useMemo(
    () => schedules.filter((sch) => isEnabled(sch.time)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedules]
  );

  // Verificar si todos los turnos disponibles están seleccionados
  const allAvailableSelected = useMemo(() => {
    if (availableSchedules.length === 0) return false;
    return availableSchedules.every((sch) => checkedSchedules.has(sch.schedule_id));
  }, [availableSchedules, checkedSchedules]);

  // Función para seleccionar/deseleccionar todos los turnos disponibles
  const handleSelectAll = () => {
    if (allAvailableSelected) {
      // Deseleccionar todos los disponibles
      availableSchedules.forEach((sch) => {
        if (checkedSchedules.has(sch.schedule_id)) {
          setSchedules(sch as IScheduleEntityFront);
        }
      });
    } else {
      // Seleccionar todos los disponibles
      availableSchedules.forEach((sch) => {
        if (!checkedSchedules.has(sch.schedule_id)) {
          setSchedules(sch as IScheduleEntityFront);
        }
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          className="w-full justify-between h-8 px-2 text-sm"
        >
          {selectedLabel}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="p-0"
        style={{ width: triggerW || undefined, maxWidth: '92vw' }}
      >
        <Command>
          <CommandList className="max-h-80">
            <CommandGroup heading="Turnos">
              {/* Checkbox "Seleccionar todos" como primer elemento */}
              {availableSchedules.length > 0 && (
                <CommandItem
                  onSelect={handleSelectAll}
                  className="text-base font-medium border-b"
                >
                  <Flex className="items-center gap-2">
                    <Checkbox
                      checked={allAvailableSelected}
                      className="h-4 w-4 rounded-[4px] pointer-events-none"
                    />
                    <span className="text-base">Seleccionar todos</span>
                  </Flex>
                </CommandItem>
              )}
              {schedules.map((sch) => {
                const enabled = isEnabled(sch.time);
                const checked = checkedSchedules.has(sch.schedule_id);
                return (
                  <CommandItem
                    key={sch.schedule_id}
                    value={`${sch.name} ${sch.time}`}
                    onSelect={() => toggleSchedule(sch as IScheduleEntityFront)}
                    className={cn('text-base', !enabled && 'opacity-50')}
                  >
                    <Flex className="items-center gap-2">
                      <Checkbox
                        checked={checked}
                        className="h-4 w-4 rounded-[4px] pointer-events-none"
                      />
                      <span className="text-base">
                        {sch.name} — {sch.time.slice(0, 5)}
                        {!enabled ? ' (cerrado)' : ''}
                      </span>
                    </Flex>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center justify-between gap-2 px-2 py-2 border-t">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-base"
              onClick={clearAll}
              disabled={checkedSchedules.size === 0}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-base"
              onClick={() => setOpen(false)}
            >
              Listo
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SchedulesCheckboxListMobile;
