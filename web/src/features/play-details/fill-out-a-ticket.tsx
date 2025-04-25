import { Flex } from '@/components/flex';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PlusIcon, TrashIcon } from 'lucide-react';

import GameTurns from '@/features/play-details/game-turns.tsx';

const FillOutATicket = () => {
  return (
    <Flex className={'flex-col xl:flex-row py-[36px] gap-[36px]'}>
      <Flex className={'flex-1 max-w-[380px] '}>
        <form className={'w-full '}>
          <Flex className={'flex-col space-y-4 border px-4 pt-8 bg-[var(--bg-card)] rounded-[--rounded-form]'}>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'number'}> Numero </Label>
              <Input
                id="number"
                name={'ticket-number'}
                type={'number'}
                placeholder={'000000'}
                className={'bg-[var(--bg-card)]'}
              />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'amount'}> Monto </Label>
              <Input
                id="amount"
                name={'ticket-amount'}
                type={'number'}
                placeholder={'000000'}
                className={'bg-[var(--bg-card)]'}
              />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'place'}> Ubicación </Label>
              <Input
                id="place"
                name={'ticket-place'}
                type={'number'}
                placeholder={'000'}
                className={'bg-[var(--bg-card)]'}
              />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'with'}> Con </Label>
              <Input
                id="with"
                name={'ticket-with'}
                type={'number'}
                placeholder={'000'}
                className={'bg-[var(--bg-card)]'}
              />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'position'}> Posición </Label>
              <Input
                id="position"
                name={'ticket-position'}
                type={'number'}
                placeholder={'000'}
                className={'bg-[var(--bg-card)]'}
              />
            </Flex>
            <Flex className={' gap-4 py-[24px]'}>
              <Button type={'button'} className={'flex-1'}>
                <PlusIcon /> Agregar
              </Button>
              <Button type={'reset'} variant={'outline'} className={'flex-1 max-w-[120px]  '}>
                <TrashIcon /> Borrar
              </Button>
            </Flex>
          </Flex>
        </form>
      </Flex>
      <GameTurns />
    </Flex>
  );
};

export default FillOutATicket;
