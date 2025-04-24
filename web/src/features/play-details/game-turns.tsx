import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Flex, FlexCol } from '@/components/flex';
import { useKeyboardCheckboxes } from '@/hooks/useHotkeyCheckbox.ts';
import {  ClockIcon, TicketIcon } from 'lucide-react';

import HeaderTitleSection from '@/components/header-title-section';

const GameTurns = () => {
  const { f1, f2, f3, f4, f5 } = useKeyboardCheckboxes();

  return (
    <Flex className="flex-col space-y-8 flex-1">
      <FlexCol className=" border-2 px-4 py-6">

        <HeaderTitleSection
          title={'Turnos'}
          icon={<ClockIcon size="24px" />}
          iconClassName="text-primary"
          variant={'large'}
          className={'pb-2'}
        />
        <Flex className="pt-2 space-x-4">
          <Flex className="gap-2">
            <Label htmlFor="f1">
              La Previa <span className="text-neutral-400">[F1]</span>
            </Label>
            <Checkbox
              id="f1"
              ref={f1.ref}
              checked={f1.checked}
              onCheckedChange={() => f1.setChecked((prev) => !prev)}
              className="  border-2 border-primary"
            />
          </Flex>

          <Flex className="gap-2">
            <Label htmlFor="primera">
              Primera <span className="text-neutral-400">[F2]</span>
            </Label>
            <Checkbox
              id="primera"
              checked={f2.checked}
              onCheckedChange={() => f2.setChecked((prev) => !prev)}
              className="  border-2 border-primary"
            />
          </Flex>

          <Flex className="gap-2">
            <Label htmlFor="f2">
              Matutina <span className="text-neutral-400">[F3]</span>
            </Label>
            <Checkbox
              id="f2"
              ref={f2.ref}
              checked={f3.checked}
              onCheckedChange={() => f3.setChecked((prev) => !prev)}
              className="border-2 border-primary"
            />
          </Flex>

          <Flex className="gap-2">
            <Label htmlFor="f3">
              Vespertina <span className="text-neutral-400">[F4]</span>
            </Label>
            <Checkbox
              id="f3"
              ref={f3.ref}
              checked={f4.checked}
              onCheckedChange={() => f4.setChecked((prev) => !prev)}
              className="border-2 border-primary"
            />
          </Flex>

          <Flex className="gap-2">
            <Label htmlFor="f4">
              Nocturna <span className="text-neutral-400">[F5]</span>
            </Label>
            <Checkbox
              id="f4"
              ref={f4.ref}
              checked={f5.checked}
              onCheckedChange={() => f5.setChecked((prev) => !prev)}
              className="border-2 border-primary"
            />
          </Flex>
        </Flex>
      </FlexCol>
      <Flex className="flex-col border-2 p-4">
        <HeaderTitleSection
          title={'Quniela'}
          icon={<TicketIcon size="24px" />}
          iconClassName="text-primary"
          variant={'large'}
        />

      </Flex>
    </Flex>
  );
};

export default GameTurns;
