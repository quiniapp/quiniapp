import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SkeletonList from '@/components/skeletons/skeleton-list';

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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {schedules.map((schedule, index) => (
        <div key={schedule.schedule_id} className="flex items-center space-x-2">
          <Controller
            name={name}
            control={control}
            render={({ field }) => {
              const selectedIds: string[] = field.value || [];
              const isChecked = selectedIds.includes(schedule?.schedule_id);

              const handleChange = (checked: boolean) => {
                const updated = checked
                  ? [...selectedIds, schedule.schedule_id]
                  : selectedIds.filter((id: string) => id !== schedule.schedule_id);
                field.onChange(updated);
              };

              return (
                <>
                  <Checkbox
                    id={`schedule-${index}`}
                    checked={isChecked}
                    onCheckedChange={handleChange}
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
    </div>
  );
}
