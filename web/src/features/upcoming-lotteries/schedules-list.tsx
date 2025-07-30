import { Label } from '@/components/ui/label';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { Flex } from '@/components/flex';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { useSchedules } from '@/hooks/useSchedules';
import { Fragment } from 'react/jsx-runtime';

export interface ScheduleProps {
  schedule_id: string;
  name: string;
  time: string;
  active: boolean;
}

interface ScheduleRadioListProps {
  handleSchedule: (id: string) => void;
  selectedSchedule:string
}

export const ScheduleRadioList = ({ selectedSchedule,handleSchedule }: ScheduleRadioListProps) => {
  const { data: schedules, isLoading } = useSchedules();

  if (isLoading) return <SkeletonList row={2} />;
  return (
    <RadioGroup className="flex justify-between" onValueChange={handleSchedule} value={selectedSchedule}>
      {schedules?.data?.schedule?.map((schedule: IScheduleEntityFront) => (
        <Fragment key={schedule.schedule_id}>
          <RadioGroupItem
            id={schedule.schedule_id}
            value={schedule.schedule_id}
            className="border-2 border-primary"
          />
          <Label
            htmlFor={schedule.schedule_id}
            className="1440:text-sm text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {schedule.name} ({schedule.time.slice(0, 5)})
          </Label>
        </Fragment>
      ))}
    </RadioGroup>
  );
};
