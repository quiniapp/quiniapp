import { Ticket } from 'lucide-react';
import { useResults } from './context/ResultsContext';
import { RadioGroupSection } from './components/RadioGroupSection';

type Quini = {
  lottery_id: string;
  name: string;
};

interface QuiniItem extends Quini {
  id: string;
  label: string;
}

const QuiniChecks = () => {
  const { lotteries, handleLotterySelect } = useResults();

  // Transform lotteries to match RadioItem interface
  const lotteryItems: QuiniItem[] = (lotteries ?? []).map((lottery) => ({
    ...lottery,
    id: lottery.lottery_id,
    label: lottery.name,
  }));

  return (
    <RadioGroupSection
      title="Quinielas"
      className=''
      icon={<Ticket />}
      items={lotteryItems}
      onValueChange={handleLotterySelect}
    />
  );
};

export default QuiniChecks;
