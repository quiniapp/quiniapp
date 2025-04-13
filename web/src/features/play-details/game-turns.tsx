import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Flex from '@/components/flex';
import { useKeyboardCheckboxes } from '@/hooks/useHotkeyCheckbox.ts';

const GameTurns = () => {
  const { f1, f2, f3, f4, f5 } = useKeyboardCheckboxes();

  return (
    <Flex className="flex-col space-y-8 flex-1">
      <Flex className="flex-col border-2 p-4">
        <p className="text-lg">Turnos</p>
        <Flex className="pt-8 space-x-4">
          <Flex className="gap-2">
            <Label htmlFor="f1">
              La Previa <span className="text-neutral-400">[F1]</span>
            </Label>
            <Checkbox
              id="f1"
              ref={f1.ref}
              checked={f1.checked}
              onCheckedChange={() => f1.setChecked((prev) => !prev)}
              className="border-2"
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
              className="border-2"
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
              className="border-2"
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
              className="border-2"
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
              className="border-2"
            />
          </Flex>
        </Flex>
      </Flex>
      <Flex className="flex-col border-2 p-4">
        <p className="text-lg">Qunielas</p>
      </Flex>
    </Flex>
  );
};

export default GameTurns;
