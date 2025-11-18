import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';
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
    <CheckboxWithLabel
      id={lottery.lottery_id}
      label={lottery.name}
      checked={checkedLottery}
      onClick={() => setLotteries(lottery)}
      labelClassName="min-w-[90px]"
    />
  );
};

export default LotteryCheckboxList;
