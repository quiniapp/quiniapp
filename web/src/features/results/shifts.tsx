import { Clock } from 'lucide-react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import { Label } from '@/components/ui/label';
import HeaderTitleSection from '@/components/header-title-section';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type Shift = {
  readonly id: string;
  readonly value: string,
  readonly label: string;
  readonly time: string;
};

interface ResultShiftsProps {
  shifts: readonly Shift[];
  onShiftSelect: (shiftId: string) => void; // Callback function
}

const ResultShifts = ({ shifts, onShiftSelect }: ResultShiftsProps) => {
  return (
    <Box className="  rounded-lg px-4 py-8 bg-[var(--bg-card)]">
      <HeaderTitleSection
        title={'Turno'}
        icon={<Clock size="24px" />}
        iconClassName="text-primary"
        variant={'large'}
        className={'pb-2'}
      />
      <RadioGroup onValueChange={onShiftSelect}>
        <Box className="grid grid-cols-3 gap-4">
        {shifts.map((turno: Shift) => (
          <Flex key={turno.id} className="  items-center space-x-4">
            <RadioGroupItem id={turno.id} value={turno.value} className="border border-primary" />
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
  );
};

export default ResultShifts;
