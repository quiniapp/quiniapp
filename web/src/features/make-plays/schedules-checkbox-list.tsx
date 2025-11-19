import { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { ClockIcon, } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';
import { Flex } from '@/components/flex';
import Box from '@/components/box';
import CheckboxSection from '@/features/make-plays/components/CheckboxSection';

import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useClock } from '@/providers/ClockProvider';
import { USER_TYPE } from '@helper/types/user.type';
import { useAuth } from '@/contexts/AuthContext';

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SchedulesProps {
  time: string;
  schedule_id: string;
  name: string;
}

interface SchedulesCheckboxListProps {
  schedules: SchedulesProps[];
  setSchedules: (schedule: IScheduleEntityFront) => void; // toggle
  checkedSchedules: Map<string, IScheduleEntityFront>;
}

const ScheduleCheckboxList = ({
  schedules,
  setSchedules,
  checkedSchedules,
}: SchedulesCheckboxListProps) => {
  const { role } = useAuth();
  const { isScheduleAfter, isLessThanTenMinutes } = useClock();

  // F-keys (solo para desktop)
  const refs = Array.from({ length: 10 }, () => useRef<HTMLButtonElement>(null));
  const keyMap: Record<string, number> = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`F${i + 1}`, i])
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = keyMap[e.key];
      if (idx !== undefined && refs[idx]?.current) {
        e.preventDefault();
        refs[idx]!.current!.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // no dependas de schedules acá para no recrear el listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers
  const isEnabled = (t: string) =>
    (isScheduleAfter(t) && !isLessThanTenMinutes(t)) || role !== USER_TYPE.CASHIER;

  // ===== Desktop / Tablet (sm+) =====
  const desktopGrid = (
    <Box className="hidden sm:grid grid-flow-col grid-rows-3 gap-x-6 gap-y-2 w-fit">
      {schedules.slice(0, 10).map((sch, index) => {
        const enabled = isEnabled(sch.time);
        const checked = checkedSchedules.has(sch.schedule_id);

        return (
          <div key={sch.schedule_id}>
            <CheckboxWithLabel
              id={`f${index + 1}`}
              label={
                <>
                  {sch.name} [{sch.time.slice(0, 5)}]{' '}
                  <span className="text-primary-light">[F{index + 1}]</span>
                </>
              }
              checked={checked}
              disabled={!enabled}
              onClick={() => setSchedules(sch as IScheduleEntityFront)}
              labelClassName="text-base"
            />
            <button
              ref={refs[index]}
              onClick={() => setSchedules(sch as IScheduleEntityFront)}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        );
      })}
    </Box>
  );

  // ===== Mobile (< sm): Popover + Command (multi-select sin auto-cerrar) =====
  const [open, setOpen] = useState(false);
  const selectedCount = checkedSchedules.size;
  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return 'Seleccionar turnos';
    if (selectedCount === 1) return `${Array.from(checkedSchedules.values())[0].name}`;
    return `${selectedCount} seleccionados`;
  }, [selectedCount, checkedSchedules]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerW, setTriggerW] = useState(0);
  useLayoutEffect(() => {
    const update = () => setTriggerW(triggerRef.current?.offsetWidth ?? 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const toggleSchedule = (sch: IScheduleEntityFront) => {
    if (!isEnabled(sch.time)) return;
    setSchedules(sch); // tu setter ya togglea
  };
  const clearAll = () => {
    // deseleccionar todas las ya marcadas togglenado cada una
    Array.from(checkedSchedules.values()).forEach(setSchedules);
  };
  const mobilePicker = (
    <div className="sm:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            className="w-full justify-between h-9 px-3 text-sm sm:text-base"
          >
            {selectedLabel}
          </Button>
        </PopoverTrigger>

        {/* 👇 ancho igual al trigger; offset pequeño para que no se pegue */}
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="p-0"
          style={{ width: triggerW || undefined, maxWidth: '92vw' }}
        >
          <Command>
            <CommandList className="max-h-56">
              <CommandGroup heading="Turnos">
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
                        {/* ✅ check cuadrado */}
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
                  onClick={() => {
                    // limpiar: togglear todas las seleccionadas
                    clearAll();
                  }}
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
    </div>
  );

  return (
    <CheckboxSection title="Turnos" icon={<ClockIcon size="16px" />} className="w-full">
      {desktopGrid}
      {mobilePicker}
    </CheckboxSection>
  );
};

export default ScheduleCheckboxList;
