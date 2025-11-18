import { CheckboxWithLabel } from '@/components/checkbox-with-label';
import SkeletonList from '@/components/skeletons/skeleton-list.tsx';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

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
            <CheckboxWithLabel
              key={lot.lottery_id}
              id={lot.lottery_id}
              label={lot.name}
              checked={lotteries.includes(lot.lottery_id)}
              onClick={() => onChange(lot.lottery_id)}
              labelClassName="1440:text-sm text-xs font-medium leading-none"
            />
          );
        })}
      </div>
    </div>
  );
}
