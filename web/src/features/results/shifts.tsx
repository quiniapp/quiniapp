import { Clock } from 'lucide-react';
// @UI
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioButtonWithLabel } from '@/components/button/RadioButtonWithLabel';
// @Components
import Box from '@/components/box';
import HeaderTitleSection from '@/components/header-title-section';
// @Hooks
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import { useEffect, useRef } from 'react';

type Shift = {
  schedule_id: string;
  name: string;
  time: string;
};

interface ResultShiftsProps {
  schedules: Shift[];
  onScheduleSelect: (shiftId: string) => void;
}

const ResultShifts = ({ schedules, onScheduleSelect }: ResultShiftsProps) => {
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

  return (
    <Box className="  rounded-lg px-4 1440:py-8 py-4 bg-card">

      <HeaderTitleSection
        title={'Turno'}
        icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
        variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
        className={'pb-2'}
      />
      <RadioGroup onValueChange={onScheduleSelect}>
        <Box className="grid 1440:grid-cols-3 grid-cols-2 1440:gap-4 gap-1">
          {schedules?.map((turno: Shift, index) => (
            <RadioButtonWithLabel
              key={turno.schedule_id}
              ref={keyboardMap[index]?.ref}
              id={turno.schedule_id}
              value={turno.schedule_id}
              label={`${turno.name} [${turno.time}] [F${index + 1}]`}
              radioClassName="border border-primary"
              labelClassName="text-base xl:text-lg"
              className="h-[36px]"
            />
          ))}
        </Box>
      </RadioGroup>
    </Box>
  );
};

export default ResultShifts;
