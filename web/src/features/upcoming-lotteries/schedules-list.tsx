import SkeletonList from '@/components/skeletons/skeleton-list';
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioButtonWithLabel } from '@/components/button/RadioButtonWithLabel';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';

export interface ScheduleProps {
  schedule_id: string;
  name: string;
  time: string;
  active: boolean;
}

interface ScheduleRadioListProps {
  handleSchedule: (id: string) => void;
  selectedSchedule: string;
}

export const ScheduleRadioList = ({ selectedSchedule, handleSchedule }: ScheduleRadioListProps) => {
  const { data: schedules, isLoading } = useSchedules();

  if (isLoading) return <SkeletonList row={2} />;
  return (
    <RadioGroup
      className="flex justify-between gap-2 md:gap-4"
      onValueChange={handleSchedule}
      value={selectedSchedule}
    >
      {schedules?.map((schedule: IScheduleEntityFront) => (
        <RadioButtonWithLabel
          key={schedule.schedule_id}
          id={schedule.schedule_id}
          value={schedule.schedule_id}
          label={`${schedule.name} (${schedule.time.slice(0, 5)})`}
          labelClassName="1440:text-sm text-xs"
          className='gap-1 sm:gap-2 2xl:gap-4'
        />
      ))}
    </RadioGroup>
  );
};
