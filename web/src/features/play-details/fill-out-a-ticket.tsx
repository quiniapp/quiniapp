import { PlusIcon, TrashIcon } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import GameTurns from '@/features/play-details/game-turns.tsx';
import PlayDetailGameTable from '@/features/play-details/play-detail-game-table.tsx';
import { useIsButtonEnabled } from '@/hooks/use-is-button-enabled.ts';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import { BET_TYPE, PLACE_TYPE } from '../../../../helper/types/bet.type';
import { useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import dayjs from 'dayjs';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
export interface IBetForm {
  number?: string;
  amount?: number;
  place?: PLACE_TYPE;
  with?: string | null;
  position?: PLACE_TYPE | null;
}

const betTypeDictionary = (length?: number, redouble?: boolean) => {
  switch (length) {
    case 10:
      return BET_TYPE.BORRATINA;
      break;
    case 4:
      return BET_TYPE.QUATERN;
      break;
    case 3:
      return BET_TYPE.TERN;
      break;
    case 2:
      if (length === 2 && redouble) return BET_TYPE.REDOUBLE;
      return BET_TYPE.DOUBLE;
      break;
    case 1:
      return BET_TYPE.ONE;
      break;
  }
};

const FillOutATicket = () => {
  const { user } = useSessionStore();
  const [bets, setBets] = useState<INewBetEntity[]>([]);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const [bet, setBet] = useState<IBetForm>({
    number: undefined,
    amount: undefined,
    place: PLACE_TYPE.HEAD,
    with: null,
    position: null,
  });
  const handleSchedules = (schedule: IScheduleEntityFront) => {
    setSchedules((prev) => {
      const newMap = new Map(prev); // Clonás el Map

      if (newMap.has(schedule.schedule_id)) {
        newMap.delete(schedule.schedule_id);
      } else {
        newMap.set(schedule.schedule_id, schedule);
      }

      return newMap; // Retornás un nuevo objeto
    });
  };
  const handleLotteries = (lottery: ILotteryEntityFront) => {
    setLotteries((prev) => {
      const newMap = new Map(prev); // Clonás el Map

      if (newMap.has(lottery.lottery_id)) {
        newMap.delete(lottery.lottery_id);
      } else {
        newMap.set(lottery.lottery_id, lottery);
      }

      return newMap; // Retornás un nuevo objeto
    });
  };

  const handleBet = (key: string, value: string | number) => {
    setBet((prev) => {
      if (key === 'place' || key === 'position') {
        if (value === '1') {
          return { ...prev, [key]: PLACE_TYPE.HEAD };
        }
        if (value === '5' || !value) {
          return { ...prev, [key]: PLACE_TYPE.FIVE };
        }
        if (value === '10' || !value) {
          return { ...prev, [key]: PLACE_TYPE.TEN };
        }
        if (value === '20' || !value) {
          return { ...prev, [key]: PLACE_TYPE.TWENTY };
        }
      }

      return { ...prev, [key]: value };
    });
  };

  const handleCreateBet = () => {
    const date = dayjs().format('DD-MM-YYYY');

    const lotterySchedule = lotteries
      .map((lot) => {
        return schedules.map((sch) => {
          return {
            schedule_id: sch,
            lottery_id: lot,
          };
        });
      })
      .flat();
    setBets((prev) => {
      const newBet = lotterySchedule.map((lotSched) => {
        return {
          ...lotSched,
          number: bet.number,
          amount: bet.amount,
          place: bet.place,
          with: bet.with,
          position: bet.position,
          bet_type: betTypeDictionary(bet.number?.length, !!bet.with?.length),
          date: date,
          user_id: user?.user_id,
        } as INewBetEntity;
      });
      console.log('newBet', newBet);

      return [...prev, ...newBet];
    });
  };
  console.log(bets);

  const isEnabled = useIsButtonEnabled();
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
                  type={'string'}
                  placeholder={'0000'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('number', e.target.value)}
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
                  onChange={(e) => handleBet('amount', e.target.value)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'place'}> Ubicación </Label>
                <Input
                  id="place"
                  name={'ticket-place'}
                  type={'number'}
                  placeholder={'1, 5, 10, 20'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('place', e.target.value)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'with'}> Con </Label>
                <Input
                  id="with"
                  name={'ticket-with'}
                  type={'number'}
                  placeholder={'00'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('with', e.target.value)}
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
                  onChange={(e) => handleBet('position', e.target.value)}
                />
              </Box>
              <Flex className={' gap-4 pt-[24px]'}>
                <Button
                  type={'button'}
                  className={'flex-1 disabled:bg-pink-50'}
                  disabled={!isEnabled}
                  onClick={() => handleCreateBet()}
                >
                  <PlusIcon /> Agregar
                </Button>
                <Button type={'reset'} variant={'outline'} className={'flex-1 max-w-[120px]  '}>
                  <TrashIcon /> Borrar
                </Button>
              </Flex>
            </FlexCol>
          </form>
        </Flex>
        <GameTurns setLotteries={handleLotteries} setSchedules={handleSchedules} />
      </Flex>
      <PlayDetailGameTable bets={bets} />
    </FlexCol>
  );
};

export default FillOutATicket;
