// components/ScheduleRadioGroup.tsx
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface ScheduleProps {
  schedule_id: string;
  name: string;
  time: string;
  active: boolean;
}

interface ScheduleRadioGroupProps<T extends FieldValues> {
  schedules: ScheduleProps[];
  control: Control<T>;
  name: Path<T>;
}

export function ScheduleRadioGroup<T extends FieldValues>({
  schedules,
  control,
  name,
}: ScheduleRadioGroupProps<T>) {
  if (!Array.isArray(schedules) || schedules.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {schedules.map((schedule) => (
        <div key={schedule.schedule_id} className="flex items-center space-x-2">
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <RadioGroup onValueChange={field.onChange} value={field.value}>
                <RadioGroupItem
                  value={schedule.schedule_id}
                  id={schedule.schedule_id}
                  className="border-2 border-primary rounded-full aspect-square w-4 h-4"
                />
              </RadioGroup>
            )}
          />

          <Label
            htmlFor={schedule.schedule_id}
            className="1440:text-sm text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {schedule.name} ({schedule.time.slice(0, 5)})
          </Label>
        </div>
      ))}
    </div>
  );
}
