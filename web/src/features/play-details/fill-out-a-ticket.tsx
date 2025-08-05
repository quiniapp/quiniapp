import { PlusIcon, TrashIcon } from 'lucide-react';
import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import GameTurns from '@/features/play-details/game-turns.tsx';
import { useIsButtonEnabled } from '@/hooks/use-is-button-enabled.ts';
import { PLACE_TYPE } from '../../../../helper/types/bet.type';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { IBetTable, ILotterySchedule } from '.';
import { placeTypeParse } from '../../../../helper/functions/placeTypeParse';

export interface IBetForm {
  number: string;
  amount?: number;
  place: string;
  with?: string;
  position?: string;
}

const FillOutATicket = ({
  setTotalAmount,
  setPartialAmount,
  setBets,
}: {
  setTotalAmount: React.Dispatch<React.SetStateAction<number>>;
  setPartialAmount: React.Dispatch<React.SetStateAction<number>>;
  setBets: React.Dispatch<React.SetStateAction<IBetTable[]>>;
}) => {
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const [bet, setBet] = useState<IBetForm>({
    number: '',
    amount: undefined,
    place: '',
    with: '',
    position: '',
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
      inputRefs[nextIdx].current?.focus();
      if (nextIdx === 1) {
        setBet((prev) => ({
          ...prev,
          amount: undefined,
        }));
        inputRefs[nextIdx].current?.select();
      }
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
      return { ...prev, [key]: value };
    });
  };

  const handleCreateBet = () => {
    const lotterySchedule: ILotterySchedule[] = Array.from(schedules.values()).map((sch) => {
      return {
        schedule: sch,
        lotteries: Array.from(lotteries.values()),
      };
    });

    setBets((prev) => {
      const newBet: IBetTable = {
        number: bet?.number ?? '',
        amount: +bet.amount!,
        place: placeTypeParse(bet?.place) ?? PLACE_TYPE.HEAD,
        with: bet?.with ?? '',
        position: placeTypeParse(bet.position),
        scheduleLottery: lotterySchedule,
      };
      const scheduleLotteryCombinations = schedules.size * lotteries.size;

      setPartialAmount((prev) => prev + newBet.amount * scheduleLotteryCombinations);
      setTotalAmount((prev) => prev + newBet.amount * scheduleLotteryCombinations);
      // Resetear campos del form
      setBet((prev) => ({
        ...prev,
        number: '',
        place: '',
        with: '',
        position: '',
      }));

      // También podés hacer focus al campo número si querés:
      numberRef.current?.focus();

      return [newBet, ...prev];
    });
  };

  const handleResetPartial = () => {
    setPartialAmount(0);
    setOpenModal(false);
  };
  const handleDeleteForm = () => {
    setBet({
      number: '',
      amount: undefined,
      place: '',
      with: '',
      position: '',
    });
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

  // const isEnabled = useIsButtonEnabled();
  const isAddButtonEnabled = Boolean(
    bet.number &&
      (bet.number.length < 5 || bet.number.length === 10) &&
      bet?.amount &&
      bet.amount > 0 &&
      (bet.place === '' ||
        bet.place === '1' ||
        bet.place === '5' ||
        bet.place === '10' ||
        bet.place === '20') &&
      ((!bet.position && !bet.with) ||
        (bet.position &&
          (bet.position === '5' || bet.position === '10' || bet.position === '20') &&
          bet.with?.length === 2 &&
          bet.number.length === 2))
  );

  return (
    <FlexCol className={' h-fit'}>
      <Flex className={'flex-col-reverse sm:flex-row py-1 1440:py-2 gap-1'}>
        <Flex className={'flex-1  sm:max-w-[300px] '}>
          <form className={''}>
            <FlexCol className={'space-y-2 h-auto border p-2 bg-card rounded-[--rounded-form]'}>
              <Box className={'grid grid-cols-2 items-center justify-end  '}>
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
                  value={bet?.amount ?? ''}
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
                  value={bet.place ?? undefined}
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
                  type={'string'}
                  maxLength={2}
                  value={bet.with}
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
                  value={bet.position}
                  className={'bg-[var(--bg-card)]'}
                  onChange={(e) => handleBet('position', e.target.value)}
                  onKeyDown={handleInputKeyDown(4)}
                />
              </Box>
              <Flex className={' gap-2 py-2'}>
                <Button
                  type={'button'}
                  className={'flex-1 disabled:bg-pink-50'}
                  disabled={!isAddButtonEnabled}
                  onClick={() => handleCreateBet()}
                >
                  <PlusIcon /> Agregar
                </Button>
                <Button
                  type={'reset'}
                  variant={'outline'}
                  className={'flex-1 max-w-[120px]  '}
                  onClick={() => handleDeleteForm()}
                >
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
