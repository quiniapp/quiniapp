import { PlusIcon, TrashIcon } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import GameTurns from '@/features/play-details/game-turns.tsx';
import { useIsButtonEnabled } from '@/hooks/use-is-button-enabled.ts';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import { PLACE_TYPE } from '../../../../helper/types/bet.type';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import dayjs from 'dayjs';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { betTypeDictionary } from '../../../../helper/functions/betTypeDictionary';

export interface IBetForm {
  number?: string;
  amount?: number;
  place?: PLACE_TYPE;
  with?: string | null;
  position?: PLACE_TYPE | null;
}

const FillOutATicket = ({
  setTotalAmount,
  setPartialAmount,
  setBets,
}: {
  setTotalAmount: React.Dispatch<React.SetStateAction<number>>;
  setPartialAmount: React.Dispatch<React.SetStateAction<number>>;
  setBets: React.Dispatch<React.SetStateAction<INewBetEntity[]>>;
}) => {
  const { user } = useSessionStore();
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const [bet, setBet] = useState<IBetForm>({
    number: undefined,
    amount: undefined,
    place: PLACE_TYPE.HEAD,
    with: null,
    position: null,
  });
  // 1. Refs de cada input
  const numberRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const withRef = useRef<HTMLInputElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);
  // 2. Array para fácil navegación
  const inputRefs = [numberRef, amountRef, placeRef, withRef, positionRef];

  // 3. Handler de keydown en inputs
  const handleInputKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Siguiente input, cíclico
      const nextIdx = (idx + 1) % inputRefs.length;
      if(nextIdx === 1) setBet((prev) => ({
        ...prev,
        amount: undefined,
      }));
      inputRefs[nextIdx].current?.focus();
    } else if (e.key === '+') {
      e.preventDefault();
      handleCreateBet();
      // Vuelve el foco al primer input
      inputRefs[0].current?.focus();
    }
  };

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
    const date = dayjs().format('YYYY-MM-DD');

    const lotterySchedule = Array.from(lotteries.values()).flatMap((lot) =>
      Array.from(schedules.values()).map((sch) => ({
        schedule_id: sch.schedule_id,
        lottery_id: lot.lottery_id,
        schedules: sch,
        lotteries: lot,
      }))
    );
    setBets((prev) => {
      const newBet = lotterySchedule.map((lotSched) => {
        return {
          ...lotSched,
          number: bet.number,
          amount: +bet.amount!,
          place: bet.place,
          with: bet.with,
          position: bet.position,
          bet_type: betTypeDictionary(bet.number?.length, !!bet.with?.length),
          date: date,
          user_id: user?.user_id,
        } as INewBetEntity;
      });
      setPartialAmount((prev) => prev + newBet.reduce((prev, curr) => prev + curr.amount, 0));
      setTotalAmount((prev) => prev + newBet.reduce((prev, curr) => prev + curr.amount, 0));
      // Resetear campos del form
      setBet((prev) => ({
        ...prev,
        number: '',
      }));

      // También podés hacer focus al campo número si querés:
      numberRef.current?.focus();

      return [...prev, ...newBet];
    });
  };

  const handleResetPartial = () => {
    setPartialAmount(0);
    setOpenModal(false);
  };

  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === '*') {
        setOpenModal(true);
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  const isEnabled = useIsButtonEnabled();
  return (
    <FlexCol className={'py-[0px] h-fit'}>
      <Flex className={'flex-col xl:flex-row py-[16px] 1440:py-[36px] gap-[16px]'}>
        <Flex className={'flex-1 1440:max-w-[380px] max-w-[300px] '}>
          <form className={'w-full'}>
            <FlexCol className={'space-y-2 h-auto border p-4 bg-card rounded-[--rounded-form]'}>
              <Box className={'grid grid-cols-2 items-center justify-end '}>
                <Label htmlFor={'number'}> Numero </Label>
                <Input
                  ref={numberRef}
                  id="number"
                  name={'ticket-number'}
                  type={'string'}
                  maxLength={10}
                  placeholder={'0000000000'}
                  className={'bg-[var(--bg-card)]'}
                  value={bet.number ?? undefined}
                  onChange={(e) => handleBet('number', e.target.value)}
                  onKeyDown={handleInputKeyDown(0)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'amount'}> Monto </Label>
                <Input
                  ref={amountRef}
                  id="amount"
                  name={'ticket-amount'}
                  type={'number'}
                  placeholder={'000000'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('amount', e.target.value)}
                  onKeyDown={handleInputKeyDown(1)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'place'}> Ubicación </Label>
                <Input
                  ref={placeRef}
                  id="place"
                  name={'ticket-place'}
                  type={'number'}
                  placeholder={'1, 5, 10, 20'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('place', e.target.value)}
                  onKeyDown={handleInputKeyDown(2)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'with'}> Con </Label>
                <Input
                  ref={withRef}
                  id="with"
                  name={'ticket-with'}
                  type={'number'}
                  maxLength={2}
                  placeholder={'00'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('with', e.target.value)}
                  onKeyDown={handleInputKeyDown(3)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center  '}>
                <Label htmlFor={'position'}> Posición </Label>
                <Input
                  ref={positionRef}
                  id="position"
                  name={'ticket-position'}
                  type={'number'}
                  placeholder={'5, 10, 20'}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('position', e.target.value)}
                  onKeyDown={handleInputKeyDown(4)}
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
      <Suspense fallback={<div>Cargando...</div>}>
        <ResetPartialModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onClick={handleResetPartial}
        />
      </Suspense>
    </FlexCol>
  );
};

export default FillOutATicket;

const ResetPartialModal = React.lazy(
  () => import('../../../src/components/modals/ResetPartialModal')
);
