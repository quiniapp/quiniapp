import { ClockIcon } from 'lucide-react';
// Components UI
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
// Components
import { Flex, FlexCol } from '@/components/flex';
import Box from '@/components/box';
import HeaderTitleSection from '@/components/header-title-section';
// Hooks
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { useEffect, useRef } from 'react';
import { useClock } from '@/providers/ClockProvider';
import { useSessionStore } from '@/stores/sessionStore';
import { USER_TYPE } from '../../../../helper/types/user.type';

interface SchedulesProps {
  time: string;
  schedule_id: string;
  name: string;
}

interface SchedulesCheckboxListProps {
  schedules: SchedulesProps[];
  setSchedules: (schedule: IScheduleEntityFront) => void;

  checkedSchedules: Map<string, IScheduleEntityFront>;
}
const ScheduleCheckboxList = ({
  schedules,
  setSchedules,
  checkedSchedules,
}: SchedulesCheckboxListProps) => {
  const {role} = useSessionStore()
  const {isScheduleAfter } = useClock();
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
  }, [schedules, setSchedules]);

  return (
    <FlexCol className="border-2  p-2 sm:p-4 rounded-[--rounded-form]">
      <HeaderTitleSection title="Turnos" icon={<ClockIcon size="16px" />} variant="small" />
      <Box className=" grid grid-cols-2 sm:grid-cols-6 gap-[12px]">
        {schedules.map((schedule, index) => {
          const keyHandler = keyboardMap[index];

          if (!keyHandler) return null;

          return (
            <Flex key={schedule.schedule_id} className="items-center gap-2">
              <Checkbox
                checked={checkedSchedules.has(schedule.schedule_id)}
                disabled={!isScheduleAfter(schedule.time) &&role === USER_TYPE.CASHIER}
                id={`f${index + 1}`}
                ref={keyHandler.ref}
                onClick={() => {
                  setSchedules(schedule);
                }}
                className="border-2 border-primary"
              />
              <Label htmlFor={`f${index + 1}`} className="text-[12px]">
                {schedule.name} <span className="text-primary-light">[{`F${index + 1}`}]</span>
              </Label>
            </Flex>
          );
        })}
      </Box>
    </FlexCol>
  );
};

export default ScheduleCheckboxList;
