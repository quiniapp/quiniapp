import { Checkbox } from "@/components/ui/checkbox";
import { Flex } from '@/components/flex';
import { Label } from '@/components/ui/label.tsx';
import { LotteryType } from '@/types/lottery.type.ts';

interface LotteryCheckboxListProps {
  lottery: LotteryType
}

const LotteryCheckboxList = ({lottery}: LotteryCheckboxListProps) => {
  return (
    <Flex   className="items-center gap-2">
      <Label htmlFor={lottery.lottery_id} className="text-[12px] min-w-[90px]">
      {lottery.name}
      </Label>
      <Checkbox
        id={lottery.lottery_id}  checked={lottery.active} className="border-2 border-primary"
      />
    </Flex>
  );
};

export default LotteryCheckboxList;
