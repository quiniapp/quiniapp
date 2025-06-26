import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { Flex } from '@/components/flex';

export interface ScheduleProps {
  schedule_id: string;
  name: string;
  time: string;
  active: boolean;
}

interface ScheduleCheckboxListProps<T extends FieldValues> {
  schedules: ScheduleProps[];
  control: Control<T>;
  name: Path<T>;
}

export function ScheduleCheckboxList<T extends FieldValues>({
  schedules,
  control,
  name,
}: ScheduleCheckboxListProps<T>) {
  const isLoading = !schedules || schedules.length === 0;

  if (isLoading) return <SkeletonList row={2} />;

  return (
        <RadioGroup className='flex justify-between'>
          {schedules.map((schedule, index) => (
            <div key={schedule.schedule_id} className="flex items-center space-x-2">
              <Controller
                name={name}
                control={control}
                render={({ field }) => {

                  return (
                    <>
                      <RadioGroupItem
                      
                        id={`schedule-${index}`}
                        value={schedule.schedule_id}
                        className="border-2 border-primary"
                      />
                      <Label
                        htmlFor={`schedule-${index}`}
                        className="1440:text-sm text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {schedule.name} ({schedule.time.slice(0, 5)})
                      </Label>
                    </>
                  );
                }}
              />
            </div>
          ))}
      </RadioGroup>
  );
}
