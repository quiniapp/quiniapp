import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface ILottery {
  lottery_id: string;
  name: string;
  active: boolean;
}

interface LotteryCheckboxListProps<T extends FieldValues> {
  lottery: ILottery[];
  control: Control<T>;
  name: Path<T>;
}

export function LotteryCheckboxList<T extends FieldValues>({
  lottery,
  control,
  name,
}: LotteryCheckboxListProps<T>) {
  if (!lottery || lottery.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {lottery.map((lot, index) => (
          <div key={lot.lottery_id} className="flex items-center space-x-2">
            <Controller
              name={name} // 👈 ya tipado correctamente
              control={control}
              render={({ field }) => {
                const isChecked = field.value?.includes(lot.name);
                return (
                  <>
                    <Checkbox
                      id={`quiniela-${index}`}
                      className="border-2 border-primary"
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        field.onChange(
                          checked
                            ? [...field.value, lot.name]
                            : field.value.filter((v: string) => v !== lot.name)
                        );
                      }}
                    />
                    <Label
                      htmlFor={`quiniela-${index}`}
                      className="1440:text-sm text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {lot.name}
                    </Label>
                  </>
                );
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
