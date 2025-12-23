import { RadioGroup } from '@/components/ui/radio-group';
import { RadioButtonWithLabel } from '@/components/button/RadioButtonWithLabel';
import { dayParseToString, dayDictionary } from '@helper/functions/dayDictionary';
import { DayKey } from '@helper/types/schedule-lottery.type';

interface DayRadioListProps {
  handleDay: (day: DayKey) => void;
  selectedDay: DayKey | '';
}

export const DayRadioList = ({ selectedDay, handleDay }: DayRadioListProps) => {
  return (
    <RadioGroup
      className="flex justify-between gap-2 md:gap-4"
      onValueChange={(value: DayKey) => handleDay(value)}
      value={selectedDay}
    >
      {dayParseToString.map((dia) => (
        <RadioButtonWithLabel
          key={dia.toLowerCase()}
          id={dia.toLowerCase()}
          value={dia}
          label={dayDictionary[dia as keyof typeof dayDictionary]}
          labelClassName="1440:text-sm text-xs"
          className="gap-1 sm:gap-2 2xl:gap-4"
        />
      ))}
    </RadioGroup>
  );
};
