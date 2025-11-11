import { Checkbox } from '@/components/ui/checkbox';
import { Flex } from '@/components/flex';
import { Label } from '@/components/ui/label.tsx';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

interface LotteryCheckboxListProps {
  lottery: ILotteryEntityFront;
  setLotteries: (lottery: ILotteryEntityFront) => void;
  checkedLottery?: boolean;
}

const LotteryCheckboxList = ({
  lottery,
  setLotteries,
  checkedLottery,
}: LotteryCheckboxListProps) => {
  return (
    <Flex className="items-center gap-2">
      <Checkbox
        checked={checkedLottery}
        id={lottery.lottery_id}
        className="border-2 border-primary"
        onClick={() => setLotteries(lottery)}
      />
      <Label htmlFor={lottery.lottery_id} className="text-base min-w-[90px]">
        {lottery.name}
      </Label>
    </Flex>
  );
};

export default LotteryCheckboxList;
