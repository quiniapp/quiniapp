import { useEffect, useState, useRef } from 'react';

import Flex from '@/components/flex';
import { Label } from '@/components/ui/label.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx'; // Suponiendo que estás usando el componente de Shadcn

const GameTurns = () => {
  const [isF1Checked, setIsF1Checked] = useState(false);
  const [isF2Checked, setIsF2Checked] = useState(false);
  const [isF3Checked, setIsF3Checked] = useState(false);
  const [isF4Checked, setIsF4Checked] = useState(false);
  const [isF5Checked, setIsF5Checked] = useState(false);

  const refF1 = useRef<HTMLInputElement>(null);
  const refF2 = useRef<HTMLInputElement>(null);
  const refF3 = useRef<HTMLInputElement>(null);
  const refF4 = useRef<HTMLInputElement>(null);
  const refF5 = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    const keyMap: Record<string, React.Dispatch<React.SetStateAction<boolean>>> = {
      F1: setIsF1Checked,
      F2: setIsF2Checked,
      F3: setIsF3Checked,
      F4: setIsF4Checked,
      F5: setIsF5Checked,
    };

    if (keyMap[e.key]) {
      e.preventDefault();
      keyMap[e.key]((prevState) => !prevState);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Flex className={'flex-col space-y-4 flex-1'}>
      <Flex className={'flex-col border-2 p-4 '}>
        <p className={'text-lg'}> Turnos </p>
        <Flex className={'pt-8 space-x-4'}>
          <Flex className={'gap-2'}>
            <Label htmlFor={'f1'}>
              La Previa <span className={'text-neutral-400'}> [F1]</span>
            </Label>
            <Checkbox
              id="f1"
              ref={refF1}
              checked={isF1Checked}
              onCheckedChange={() => setIsF1Checked((prev) => !prev)}
              className={'border-2'}
            />
          </Flex>

          <Flex className={'gap-2'}>
            <Label htmlFor={'primera'}>
              Primera <span className={'text-neutral-400'}> [F1]</span>
            </Label>
            <Checkbox
              id="primera"
              checked={isF2Checked}
              onCheckedChange={() => setIsF1Checked((prev) => !prev)}
              className={'border-2'}
            />
          </Flex>

          <Flex className={'gap-2'}>
            <Label htmlFor={'f2'}>
              Matutina <span className={'text-neutral-400'}> [F2]</span>
            </Label>
            <Checkbox
              id="f2"
              ref={refF2}
              checked={isF3Checked}
              onCheckedChange={() => setIsF2Checked((prev) => !prev)}
              className={'border-2'}
            />
          </Flex>

          <Flex className={'gap-2'}>
            <Label htmlFor={'f3'}>
              Vespertina <span className={'text-neutral-400'}> [F3]</span>
            </Label>
            <Checkbox
              id="f3"
              ref={refF3}
              checked={isF4Checked}
              onCheckedChange={() => setIsF3Checked((prev) => !prev)}
              className={'border-2'}
            />
          </Flex>

          <Flex className={'gap-2'}>
            <Label htmlFor={'f4'}>
              Nocturna <span className={'text-neutral-400'}> [F4]</span>{' '}
            </Label>
            <Checkbox
              id="f4"
              ref={refF4}
              checked={isF5Checked}
              onCheckedChange={() => setIsF4Checked((prev) => !prev)}
              className={'border-2'}
            />
          </Flex>

          <Flex className={'gap-2'}>
            <Label htmlFor={'f5'}>
              Quiniela <span className={'text-neutral-400'}> [F5]</span>{' '}
            </Label>
            <Checkbox
              id="f5"
              ref={refF5}
              checked={isF5Checked}
              onCheckedChange={() => setIsF5Checked((prev) => !prev)}
              className={'border-2'}
            />
          </Flex>
        </Flex>
      </Flex>
      <Flex className={'flex-col border-2 p-4'}>
        <p className={'text-lg'}>Quinielas </p>
      </Flex>
    </Flex>
  );
};

export default GameTurns;
