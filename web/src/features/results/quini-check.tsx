import { Flex } from '@/components/flex';
import { Ticket } from 'lucide-react';
import { Label } from '@/components/ui/label.tsx';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import Box from '@/components/box';
import HeaderTitleSection from '@/components/header-title-section';

type Quini = {
  id: string;
  label: string;
};

interface ResultQuinisProps {
  quini: Quini[];
  onQuinielaSelect: (quinielaId: string) => void; // Callback function
}

const QuiniChecks = ({ quini, onQuinielaSelect }: ResultQuinisProps) => {
  return (
    <div>
      <Box className=" rounded-lg px-4 py-8 bg-[var(--bg-card)]">
        <HeaderTitleSection
          title={'Quinielas'}
          icon={<Ticket size="24px" />}
          variant={'large'}
          className={'pb-2'}
        />

        <RadioGroup onValueChange={onQuinielaSelect}>
          <Box className="grid grid-cols-3 gap-4">
            {quini.map((turno: Quini) => (
              <Flex key={turno.id} className=" h-[36px] items-center space-x-4">
                <RadioGroupItem value={turno.id} id={turno.id} className="border border-primary" />
                <Label
                  htmlFor={turno.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {turno.label}
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
