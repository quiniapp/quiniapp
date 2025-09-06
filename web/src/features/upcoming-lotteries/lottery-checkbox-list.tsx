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
  defaultLotteries?: string[];
  selectedDay: string;
  selectedSchedule: string;
  onChange: (id: string) => void;
  lotteries: string[];
}

export function LotteryCheckboxList({ onChange, lotteries = [] }: LotteryCheckboxListProps) {
  const { data, isLoading } = useLotteries(true);
  if (isLoading) return <SkeletonList row={5} />;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.map((lot: ILotteryEntityFront) => {
          return (
            <div key={lot.lottery_id} className="flex items-center gap-3">
              <Checkbox
                id={lot.lottery_id}
                className="border-2 border-primary"
                checked={lotteries.includes(lot.lottery_id)}
                onCheckedChange={() => {
                  onChange(lot.lottery_id);
                }}
              />
              <Label
                htmlFor={`quiniela-${lot.lottery_id}`}
                className="1440:text-sm text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {lot.name}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
