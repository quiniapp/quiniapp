import { TicketIcon } from 'lucide-react';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import Box from '@/components/box';
import CheckboxSection from '@/features/make-plays/components/CheckboxSection';
import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';

interface ILotteriesCheckboxListDesktopProps {
  setLotteries: (lottery: ILotteryEntityFront) => void;
  checkedLotteries: Map<string, ILotteryEntityFront>;
}

const LotteriesCheckboxListDesktop = ({
  setLotteries,
  checkedLotteries,
}: ILotteriesCheckboxListDesktopProps) => {
  const { data: lotteries = [] } = useLotteries();

  return (
    <CheckboxSection title="Quiniela" icon={<TicketIcon size="16px" />}>
      <Box className="grid grid-flow-col grid-rows-3 gap-x-6 gap-y-2 w-fit">
        {lotteries.map((lot) => (
          <CheckboxWithLabel
            key={lot.lottery_id}
            id={lot.lottery_id}
            label={lot.name}
            checked={checkedLotteries.has(lot.lottery_id)}
            onClick={() => setLotteries(lot)}
            labelClassName="min-w-[90px]"
          />
        ))}
      </Box>
    </CheckboxSection>
  );
};

export default LotteriesCheckboxListDesktop;
