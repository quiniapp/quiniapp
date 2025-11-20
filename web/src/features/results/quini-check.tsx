import { Ticket } from 'lucide-react';

import Box from '@/components/box';
import HeaderTitleSection from '@/components/header-title-section';
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioButtonWithLabel } from '@/components/button/RadioButtonWithLabel';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

type Quini = {
  lottery_id: string;
  name: string;
};

interface ResultQuinisProps {
  quini: Quini[];
  onLotterySelect: (quinielaId: string) => void; // Callback function
}

const QuiniChecks = ({ quini, onLotterySelect }: ResultQuinisProps) => {
  return (
    <div>
      <Box className=" rounded-lg px-4 1440:py-8 py-4 bg-card">
        <HeaderTitleSection
          title={'Quinielas'}
          icon={<Ticket size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
          variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
          className={'pb-2'}
        />

        <RadioGroup onValueChange={onLotterySelect}>
          <Box className="grid grid-cols-2 1440:grid-cols-4 sm:grid-cols-4 1440:gap-4 gap-1">
            {quini.map((turno: Quini) => (
              <RadioButtonWithLabel
                key={turno.lottery_id}
                id={turno.lottery_id}
                value={turno.lottery_id}
                label={turno.name}
                radioClassName="border border-primary"
                labelClassName="text-xs md:text-base xl:text-lg md:font-semibold"
                className="h-[36px]"
              />
            ))}
          </Box>
        </RadioGroup>
      </Box>
    </div>
  );
};

export default QuiniChecks;
