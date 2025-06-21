import { Clock } from 'lucide-react';
// @UI
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// @Components
import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';
// @Hooks
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

type Shift = {
  schedule_id: string;
  name: string;
  time: string;
};

interface ResultShiftsProps {
  schedules: Shift[];
  onScheduleSelect: (shiftId: string) => void;
}

const ResultShifts = ({ schedules, onScheduleSelect }: ResultShiftsProps) => {
  return (
    <Box className="  rounded-lg px-4 1440:py-8 py-4 bg-card">
      <HeaderTitleSection
        title={'Turno'}
        icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
        variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
        className={'pb-2'}
      />
      <RadioGroup onValueChange={onScheduleSelect}>
        <Box className="grid 1440:grid-cols-3 grid-cols-2 1440:gap-4 gap-1">
          {schedules?.map((turno: Shift) => (
            <Flex key={turno.schedule_id} className=" h-[36px]  items-center space-x-4">
              <RadioGroupItem
                id={turno.schedule_id}
                value={turno.schedule_id}
                className="border border-primary"
              />
              <Label
                htmlFor={turno.schedule_id}
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {turno.name} [{turno.time}]
              </Label>
            </Flex>
          ))}
        </Box>
      </RadioGroup>
    </Box>
  );
};

export default ResultShifts;
