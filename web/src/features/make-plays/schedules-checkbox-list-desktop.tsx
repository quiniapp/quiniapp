import { useEffect, useRef, useMemo, useCallback } from 'react';
import { ClockIcon } from 'lucide-react';
import Box from '@/components/box';
import CheckboxSection from '@/features/make-plays/components/CheckboxSection';
import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useClock } from '@/providers/ClockProvider';
import { USER_TYPE } from '@helper/types/user.type';
import { useAuth } from '@/contexts/AuthContext';
import { Text } from '@/components/atoms/Text';
import { Checkbox } from '@/components/ui/checkbox';

interface SchedulesProps {
  time: string;
  schedule_id: string;
  name: string;
}

interface SchedulesCheckboxListDesktopProps {
  schedules: SchedulesProps[];
  setSchedules: (schedule: IScheduleEntityFront) => void;
  checkedSchedules: Map<string, IScheduleEntityFront>;
}

const SchedulesCheckboxListDesktop = ({
  schedules,
  setSchedules,
  checkedSchedules,
}: SchedulesCheckboxListDesktopProps) => {
  const { role } = useAuth();
  const { isScheduleAfter, isLessThanTenMinutes } = useClock();

  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const keyMap: Record<string, number> = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`F${i + 1}`, i])
  );

  const setRef = useCallback((el: HTMLDivElement | null, index: number) => {
    refs.current[index] = el;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = keyMap[e.key];
      if (idx !== undefined && refs.current[idx]) {
        e.preventDefault();
        refs.current[idx]!.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEnabled = (t: string) =>
    (isScheduleAfter(t) && !isLessThanTenMinutes(t)) || role !== USER_TYPE.CASHIER;

  // Calcular turnos disponibles (habilitados)
  const availableSchedules = useMemo(
    () => schedules.slice(0, 10).filter((sch) => isEnabled(sch.time)),
    [schedules, isEnabled]
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

  const selectAllCheckbox = availableSchedules.length > 0 && (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={allAvailableSelected}
        onCheckedChange={handleSelectAll}
        className="h-4 w-4 rounded-[4px] border-2 border-primary"
      />
      <Text size="sm" className="text-white font-semibold">
        Todos
      </Text>
    </div>
  );

  return (
    <CheckboxSection
      title="Turnos"
      icon={<ClockIcon size="16px" />}
      className="w-full"
      headerAction={selectAllCheckbox}
    >
      <Box className="grid grid-flow-col grid-rows-3 gap-x-6 gap-y-2 w-fit">
        {schedules.slice(0, 10).map((sch, index) => {
          const enabled = isEnabled(sch.time);
          const checked = checkedSchedules.has(sch.schedule_id);

          return (
            <CheckboxWithLabel
              key={sch.schedule_id}
              ref={(el) => setRef(el, index)}
              id={`f${index + 1}`}
              label={
                <>
                  {sch.name} [{sch.time.slice(0, 5)}]{' '}
                  <Text>[F{index + 1}]</Text>
                </>
              }
              checked={checked}
              disabled={!enabled}
              onClick={() => setSchedules(sch as IScheduleEntityFront)}
              labelClassName="text-base"
            />
          );
        })}
      </Box>
    </CheckboxSection>
  );
};

export default SchedulesCheckboxListDesktop;
