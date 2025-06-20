import { Ticket } from 'lucide-react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';
import { Label } from '@/components/ui/label.tsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
          <Box className="grid 1440:grid-cols-4 grid-cols-4 1440:gap-4 gap-1">
            {quini.map((turno: Quini) => (
              <Flex key={turno.lottery_id} className=" h-[36px] items-center space-x-4">
                <RadioGroupItem
                  value={turno.lottery_id}
                  id={turno.lottery_id}
                  className="border border-primary"
                />
                <Label
                  htmlFor={turno.lottery_id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {turno.name}
                </Label>
              </Flex>
            ))}
          </Box>
        </RadioGroup>
      </Box>
    </div>
  );
};

export default QuiniChecks;
