import { useState } from 'react';

import Box from '@/components/box';
import { Fieldset } from '@/components/fieldset';
import { Flex, FlexCol } from '@/components/flex';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Label } from '@/components/ui/label.tsx';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { QUINIELA_PROVINCIAS } from '@/constants/LIstCommonBets';

interface QuinielaFieldsetProps {
  legend: string;
  namePrefix: string;
  lotteries?: ILotteryEntityFront[];
}

export const QuinielaFieldset = ({ legend, namePrefix, lotteries }: QuinielaFieldsetProps) => {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleAll = () => {
    const allIds = QUINIELA_PROVINCIAS.map((p) => `${namePrefix}-${p.label}`);
    const isAllSelected = allIds.every((id) => selected.includes(id));
    setSelected(isAllSelected ? [] : allIds);
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((val) => val !== id) : [...prev, id]));
  };

  const isChecked = (id: string) => selected.includes(id);

  const allSelected = selected.length === QUINIELA_PROVINCIAS.length;

  return (
    <Fieldset legend={legend}>
      <Box className="flex items-center gap-2">
        <Checkbox
          id={`${namePrefix}-all`}
          checked={allSelected}
          onCheckedChange={toggleAll}
          className="border-primary border"
        />
        <Label htmlFor={`${namePrefix}-all`}>Todas</Label>
      </Box>
      <FlexCol className="gap-3 overflow-y-scroll py-[20px]">
        {lotteries?.map((lot) => {
          const inputId = `${namePrefix}-${lot.name}`;
          return (
            <Flex key={inputId} className="items-center gap-2">
              <Checkbox
                id={inputId}
                name={inputId}
                className="border-primary border"
                checked={isChecked(inputId)}
                onCheckedChange={() => toggleOne(inputId)}
              />
              <Label
                htmlFor={inputId}
                className={
                  'w-full hover:cursor-pointer hover:bg-[#ffffff11] py-1 transition-all ease-in-out'
                }
              >
                {lot.name}
              </Label>
            </Flex>
          );
        })}
      </FlexCol>
    </Fieldset>
  );
};
