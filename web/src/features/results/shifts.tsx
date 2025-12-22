import { Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useResults } from './context/ResultsContext';
import { RadioGroupSection } from './components/RadioGroupSection';

type Shift = {
  schedule_id: string;
  name: string;
  time: string;
};

interface ShiftItem extends Shift {
  id: string;
  label: string;
}

const ResultShifts = () => {
  const { fetchSchedules, handleScheduleSelect } = useResults();

  const refF1 = useRef<HTMLButtonElement>(null);
  const refF2 = useRef<HTMLButtonElement>(null);
  const refF3 = useRef<HTMLButtonElement>(null);
  const refF4 = useRef<HTMLButtonElement>(null);
  const refF5 = useRef<HTMLButtonElement>(null);

  const refF6 = useRef<HTMLButtonElement>(null);
  const refF7 = useRef<HTMLButtonElement>(null);
  const refF8 = useRef<HTMLButtonElement>(null);
  const refF9 = useRef<HTMLButtonElement>(null);
  const refF10 = useRef<HTMLButtonElement>(null);

  const keyMap: Record<string, number> = {
    F1: 0,
    F2: 1,
    F3: 2,
    F4: 3,
    F5: 4,
    F6: 5,
    F7: 6,
    F8: 7,
    F9: 8,
    F10: 9,
  };

  const keyboardMap = [
    { key: 'F1', ref: refF1 },
    { key: 'F2', ref: refF2 },
    { key: 'F3', ref: refF3 },
    { key: 'F4', ref: refF4 },
    { key: 'F5', ref: refF5 },
    { key: 'F6', ref: refF6 },
    { key: 'F7', ref: refF7 },
    { key: 'F8', ref: refF8 },
    { key: 'F9', ref: refF9 },
    { key: 'F10', ref: refF10 },
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    const index = keyMap[e.key];

    if (index !== undefined) {
      e.preventDefault();

      const ref = keyboardMap[index].ref;
      if (ref?.current) {
        ref.current.click();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Transform schedules to match RadioItem interface
  const scheduleItems: ShiftItem[] = (fetchSchedules ?? []).map((schedule) => ({
    ...schedule,
    id: schedule.schedule_id,
    label: schedule.name,
  }));

  return (
    <RadioGroupSection
      title="Turno"
      icon={<Clock />}
      items={scheduleItems}
      onValueChange={handleScheduleSelect}
      keyboardRefs={keyboardMap.map((k) => k.ref)}
      getItemLabel={(item, index) => `${item.name} [${item.time}] [F${index + 1}]`}
    />
  );
};

export default ResultShifts;
