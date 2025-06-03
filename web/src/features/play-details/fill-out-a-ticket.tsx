import { PlusIcon, TrashIcon } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import GameTurns from '@/features/play-details/game-turns.tsx';
import PlayDetailGameTable from '@/features/play-details/play-detail-game-table.tsx';
import { useForm } from 'react-hook-form';
import { useIsButtonEnabled } from '@/hooks/use-is-button-enabled.ts';

const FillOutATicket = () => {
  const {} = useForm();
  const isEnabled  = useIsButtonEnabled()
  return (
    <FlexCol className={'py-[0px]'}>
      <Flex className={'flex-col xl:flex-row py-[16px] 1440:py-[36px] gap-[16px]'}>
        <Flex className={'flex-1 1440:max-w-[380px] max-w-[300px] '}>
          <form className={'w-full'}>
            <FlexCol className={'space-y-2 h-auto border p-4 bg-card rounded-[--rounded-form]'}>
              <Box className={'grid grid-cols-2 items-center justify-end '}>
                <Label htmlFor={'number'}> Numero </Label>
                <Input
                  id="number"
                  name={'ticket-number'}
                  type={'number'}
                  placeholder={'000000'}
                  className={'bg-[var(--bg-card)]'}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'amount'}> Monto </Label>
                <Input
                  id="amount"
                  name={'ticket-amount'}
                  type={'number'}
                  placeholder={'000000'}
                  className={'bg-[var(--bg-card)]'}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'place'}> Ubicación </Label>
                <Input
                  id="place"
                  name={'ticket-place'}
                  type={'number'}
                  placeholder={'000'}
                  className={'bg-[var(--bg-card)]'}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'with'}> Con </Label>
                <Input
                  id="with"
                  name={'ticket-with'}
                  type={'number'}
                  placeholder={'000'}
                  className={'bg-[var(--bg-card)]'}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'position'}> Posición </Label>
                <Input
                  id="position"
                  name={'ticket-position'}
                  type={'number'}
                  placeholder={'000'}
                  className={'bg-[var(--bg-card)]'}
                />
              </Box>
              <Flex className={' gap-4 pt-[24px]'}>
                <Button type={'button'} className={'flex-1 disabled:bg-pink-50'} disabled={!isEnabled}>
                  <PlusIcon /> Agregar
                </Button>
                <Button type={'reset'} variant={'outline'} className={'flex-1 max-w-[120px]  '}>
                  <TrashIcon /> Borrar
                </Button>
              </Flex>
            </FlexCol>
          </form>
        </Flex>
        <GameTurns />
      </Flex>
      <PlayDetailGameTable />
    </FlexCol>
  );
};

export default FillOutATicket;
