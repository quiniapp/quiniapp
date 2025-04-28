import { Clock } from 'lucide-react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import { Label } from '@/components/ui/label';
import HeaderTitleSection from '@/components/header-title-section';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

type Shift = {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly time: string;
};

interface ResultShiftsProps {
  shifts: readonly Shift[];
  onShiftSelect: (shiftId: string) => void; // Callback function
}

const ResultShifts = ({ shifts, onShiftSelect }: ResultShiftsProps) => {
  return (
    <Box className="  rounded-lg px-4 1400:py-8 py-4 bg-card">
      <HeaderTitleSection
        title={'Turno'}
        icon={<Clock  size={useMediaQuery('(min-width: 1400px)') ? '24px' : '16px'} />}
        variant={useMediaQuery('(min-width: 1400px)') ? 'large' : 'small'}
        className={'pb-2'}
      />
      <RadioGroup onValueChange={onShiftSelect}>
        <Box className="grid 1400:grid-cols-3 grid-cols-2 1400:gap-4 gap-1">
          {shifts.map((turno: Shift) => (
            <Flex key={turno.id} className=" h-[36px]  items-center space-x-4">
              <RadioGroupItem id={turno.id} value={turno.value} className="border border-primary" />
              <Label
                htmlFor={turno.id}
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {turno.label}
              </Label>
            </Flex>
          ))}
        </Box>
      </RadioGroup>
    </Box>
  );
};

export default ResultShifts;
