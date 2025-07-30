import { useEffect } from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SkeletonList from '@/components/skeletons/skeleton-list.tsx';
import { useLotteries } from '@/hooks/useLotteries';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';

export interface ILottery {
  lottery_id: string;
  name: string;
  active: boolean;
}

interface LotteryCheckboxListProps {
  defaultLotteries?: string[]

}

export function LotteryCheckboxList({defaultLotteries}: LotteryCheckboxListProps) {
  const { data, isLoading } = useLotteries(true);
  if (isLoading) return <SkeletonList row={5} />;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.data?.lottery?.map((lot:ILotteryEntityFront) => (
          <div key={lot.lottery_id} className="flex items-center space-x-2">
            <>
              <Checkbox
                id={lot.lottery_id}
                className="border-2 border-primary"
                checked={defaultLotteries?.includes(lot.lottery_id)}
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
          </div>
        ))}
      </div>
    </div>
  );
}
