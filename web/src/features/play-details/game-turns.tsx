import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Flex, FlexCol } from '@/components/flex';
import { useKeyboardCheckboxes } from '@/hooks/useHotkeyCheckbox.ts';
import { ClockIcon, TicketIcon } from 'lucide-react';

import HeaderTitleSection from '@/components/header-title-section';

import PlayDetailGameTable from '@/features/play-details/play-detail-game-table.tsx';
import Box from '@/components/box';
import { Input } from '@/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectGroup, SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';

const GameTurns = () => {
  const { f1, f2, f3, f4, f5 } = useKeyboardCheckboxes();

  return (
    <FlexCol className="flex-col 1400:space-y-6 space-y-3 flex-1">
      <Flex className={'w-full   gap-4'}>
        <Flex className={'items-center justify-center gap-4'}>
          <Label htmlFor={'user'}> Usuario</Label>
          <Input type={'text'} id={'user'} name={'user'} className={'max-w-[100px]'} />
        </Flex>
        <Flex className={'items-center justify-center gap-4'}>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Fruits</SelectLabel>
                <SelectItem value="apple">Select 1</SelectItem>
                <SelectItem value="banana">Select +</SelectItem>
                <SelectItem value="blueberry">Select +</SelectItem>
                <SelectItem value="grapes">Select +</SelectItem>
                <SelectItem value="pineapple">Select +</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Flex>
      </Flex>
      <FlexCol className=" border-2 px-4 py-4 rounded-[--rounded-form]">
        <HeaderTitleSection title={'Turnos'} icon={<ClockIcon size="16px" />} variant={'small'} />
        <Box className="pt-2 grid grid-cols-5 gap-[12px] ">
          <Flex className="items-center gap-2">
            <Label htmlFor="f1" className={'text-[12px]'}>
              La Previa <span className="text-primary-light">[F1]</span>
            </Label>
            <Checkbox
              id="f1"
              ref={f1.ref}
              checked={f1.checked}
              onCheckedChange={() => f1.setChecked((prev) => !prev)}
              className="  border-2 border-primary"
            />
          </Flex>
          <Flex className="items-center gap-2">
            <Label htmlFor="primera" className={'text-[12px]'}>
              Primera <span className="text-primary-light">[F2]</span>
            </Label>
            <Checkbox
              id="primera"
              checked={f2.checked}
              onCheckedChange={() => f2.setChecked((prev) => !prev)}
              className="  border-2 border-primary"
            />
          </Flex>

          <Flex className="items-center gap-2">
            <Label htmlFor="f2" className={'text-[12px]'}>
              Matutina <span className="text-primary-light">[F3]</span>
            </Label>
            <Checkbox
              id="f2"
              ref={f2.ref}
              checked={f3.checked}
              onCheckedChange={() => f3.setChecked((prev) => !prev)}
              className="border-2 border-primary"
            />
          </Flex>

          <Flex className="items-center gap-2">
            <Label htmlFor="f3" className={'text-[12px]'}>
              Vespertina <span className="text-primary-light">[F4]</span>
            </Label>
            <Checkbox
              id="f3"
              ref={f3.ref}
              checked={f4.checked}
              onCheckedChange={() => f4.setChecked((prev) => !prev)}
              className="border-2 border-primary"
            />
          </Flex>

          <Flex className="items-center gap-2">
            <Label htmlFor="f4" className={'text-[12px]'}>
              Nocturna <span className="text-primary-light">[F5]</span>
            </Label>
            <Checkbox
              id="f4"
              ref={f4.ref}
              checked={f5.checked}
              onCheckedChange={() => f5.setChecked((prev) => !prev)}
              className="border-2 border-primary"
            />
          </Flex>
        </Box>
      </FlexCol>
      <FlexCol className="min-h-[280px] border-2 p-4 rounded-[--rounded-form]">
        <HeaderTitleSection title={'Quniela'} icon={<TicketIcon size="16px" />} variant={'small'} />
        <PlayDetailGameTable />
      </FlexCol>
    </FlexCol>
  );
};

export default GameTurns;
