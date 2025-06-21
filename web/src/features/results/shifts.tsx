import { Clock } from 'lucide-react';
// @UI
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// @Components
import Box from '@/components/box';
import { Flex } from '@/components/flex';
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

  const keyMap: Record<string, number> = {
    F1: 0,
    F2: 1,
    F3: 2,
    F4: 3,
    F5: 4,
  };
  const keyboardMap = [
    { key: 'F1', ref: refF1 },
    { key: 'F2', ref: refF2 },
    { key: 'F3', ref: refF3 },
    { key: 'F4', ref: refF4 },
    { key: 'F5', ref: refF5 },
  ];

  const handleKeyDown = (e: KeyboardEvent) => {

    const index = keyMap[e.key];

    if (index !== undefined) {
      e.preventDefault();

      const ref = keyboardMap[index].ref;
      if (ref?.current) {
        console.log('ref?.current');
        ref.current.click();
      }
    }
  };
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  console.log(schedules)
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
            <Flex key={turno.schedule_id} className=" h-[36px]  items-center space-x-4">
              <RadioGroupItem
                ref={keyboardMap[index]?.ref}
                id={turno.schedule_id}
                value={turno.schedule_id}
                className="border border-primary"
              />
              <Label
                htmlFor={turno.schedule_id}
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {turno.name} [{turno.time}] [F{index+1}]
              </Label>
            </Flex>
          ))}
        </Box>
      </RadioGroup>
    </Box>
  );
};

export default ResultShifts;
