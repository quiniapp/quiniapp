import { Checkbox } from '@/components/ui/checkbox';
import { Flex } from '@/components/flex';
import { Label } from '@/components/ui/label.tsx';
import { LotteryType } from '@/types/lottery.type.ts';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';

interface LotteryCheckboxListProps {
  lottery: LotteryType;
    setLotteries: (lottery: ILotteryEntityFront) => void
}

const LotteryCheckboxList = ({ lottery, setLotteries }: LotteryCheckboxListProps) => {
  return (
    <Flex className="items-center gap-2">
      <Label htmlFor={lottery.lottery_id} className="text-[12px] min-w-[90px]">
        {lottery.name}
      </Label>
      <Checkbox 
        id={lottery.lottery_id}
        className="border-2 border-primary"
        onClick={()=>setLotteries(lottery)}
      />
    </Flex>
  );
};

export default LotteryCheckboxList;
