import SkeletonList from '@/components/skeletons/skeleton-list';
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioButtonWithLabel } from '@/components/radio-button-with-label';
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
      className="flex justify-between"
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
        />
      ))}
    </RadioGroup>
  );
};
