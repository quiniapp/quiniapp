import { PlusIcon, TrashIcon } from 'lucide-react';
import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import GameTurns from '@/features/make-plays/game-turns';
import { PLACE_TYPE } from '@helper/types/bet.type';
import React, { useEffect, useRef, useState } from 'react';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { placeTypeParse } from '@helper/functions/placeTypeParse';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import dayjs from 'dayjs';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { dayParseToString } from '@helper/functions/dayDictionary';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.request';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { usePlayDetails } from './context/MakePlaysContext';

const getScheduleId = (s: IScheduleEntityFront) => s.schedule_id;
const getLotteryId = (l: ILotteryEntityFront) => l.lottery_id;

const makeOrderIndex = <T,>(getId: (x: T) => string, arr?: T[]) => {
  if (!arr) return;
  const m = new Map<string, number>();
  arr.forEach((x, i) => m.set(getId(x), i));
  return m;
};
export interface IBetForm {
  number: string;
  amount?: number;
  place: string;
  with?: string;
  position?: string;
}

const FillOutATicket = () => {
  const {
    lotteries,
    schedules,
    setBets,
    setTotalAmount,
    setPartialAmount,
    isEnabledCreateBet,
    isEnabledCreateBetByAdmin,
    setOpenDeleteModal,
  } = usePlayDetails();

  const isEnabled = isEnabledCreateBet && isEnabledCreateBetByAdmin;
  const today = dayjs().day();
  const [bet, setBet] = useState<IBetForm>({
    number: '',
    amount: undefined,
    place: '',
    with: '',
    position: '',
  });
  const { data: scheduleLotteryPerDate } = useScheduleLottery();
  const { data: scheduleOrder } = useSchedules();
  const { data: lotteryOrder } = useLotteries();
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

  const handleBet = (key: string, value: string | number) => {
    setBet((prev) => {
      // Si es amount, parseamos a número
      if (key === 'amount') {
        const numValue = value === '' ? undefined : Number(value);
        return { ...prev, [key]: numValue };
      }
      return { ...prev, [key]: value };
    });
  };

  // Validación para inputs numéricos (solo permite dígitos 0-9)
  const handleNumericInput = (key: string, value: string) => {
    // Solo permite dígitos, elimina cualquier otro carácter
    const numericValue = value.replace(/[^0-9]/g, '');
    handleBet(key, numericValue);
  };

  const handleCreateBet = () => {
    if (!isAddButtonEnabled || !scheduleOrder || !lotteryOrder) return;
    
    const todayKey: DayKey = dayParseToString[today];
    const schLotPerDate = scheduleLotteryPerDate?.[todayKey] as
    | Record<string, string[] | undefined>
    | undefined;
    
    // 1) Tomo SOLO los schedules seleccionados (presentes en el Map `schedules`)
    //    pero ordenados según `scheduleOrder`
    const orderedSchedules = scheduleOrder
    .filter((s) => schedules.has(getScheduleId(s)))
    .map((s) => schedules.get(getScheduleId(s))!); // ya sabemos que existe
    
    // 2) Para cada schedule, tomo SOLO las loterías seleccionadas (presentes en el Map `lotteries`)
    //    y las ordeno según `lotteryOrder`
    const lotteryOrderIndex = makeOrderIndex(getLotteryId, lotteryOrder);
    
    const lotterySchedule: ILotterySchedule[] = orderedSchedules.reduce<ILotterySchedule[]>(
      (acc, sch) => {
        const ids = schLotPerDate?.[getScheduleId(sch)];
        if (!ids || ids.length === 0) return acc;
        
        // Solo las IDs que están seleccionadas en el Map `lotteries`
        const selectedIds = ids.filter((id) => lotteries.has(id));
        if (selectedIds.length === 0) return acc;
        
        const valid = selectedIds
        .map((id) => lotteries.get(id)!) // existe seguro
        .sort((a, b) => {
          const ai = lotteryOrderIndex?.get(getLotteryId(a)) ?? Number.POSITIVE_INFINITY;
          const bi = lotteryOrderIndex?.get(getLotteryId(b)) ?? Number.POSITIVE_INFINITY;
          return ai - bi;
        });
        
        if (valid.length === 0) return acc;
        
        acc.push({ schedule: sch, lotteries: valid });
        return acc;
      },
      []
    );
    
    // 3) Contar combinaciones reales (pares schedule-lottery)
    const combosCount = lotterySchedule.reduce((sum, item) => sum + item.lotteries.length, 0);
    if (combosCount === 0) return;
    
    setBets((prev) => {
      const newBet: IBetTable = {
        number: bet?.number ?? '',
        amount: +bet.amount!,
        place: placeTypeParse(bet?.place) ?? PLACE_TYPE.HEAD,
        with: bet?.with ?? '',
        position: placeTypeParse(bet.position),
        scheduleLottery: lotterySchedule,
      };

      setPartialAmount((p) => p + newBet.amount * combosCount);
      setTotalAmount((p) => p + newBet.amount * combosCount);

      setBet((prev) => ({ ...prev, number: '', place: '', with: '', position: '' }));
      numberRef.current?.focus();

      return [newBet, ...prev];
    });
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
        setOpenDeleteModal(true);
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [setOpenDeleteModal]);

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
          bet.number.length === 2)) &&
      schedules.size &&
      lotteries.size
  );

  return (
    <FlexCol className={'h-fit w-full max-w-full'}>
      <Flex className={'flex-col-reverse sm:flex-row gap-1 sm:gap-2 lg:gap-3 sm:items-stretch w-full'}>
        <Flex className={'flex-1 sm:max-w-[280px] md:max-w-[260px] lg:max-w-[320px] w-full'}>
          <form className={'w-full'}>
            <FlexCol className={'space-y-1 sm:space-y-3 lg:space-y-1 h-full border p-2 sm:p-3 lg:p-1.5 bg-card rounded-[--rounded-form] justify-between'}>
              <Box className={'grid grid-cols-2 items-center gap-1 sm:gap-2 lg:gap-0.5'}>
                <Label htmlFor={'number'} className="text-sm sm:text-base 2xl:text-lg truncate"> Numero </Label>
                <Input
                  ref={numberRef}
                  id="number"
                  name={'ticket-number'}
                  inputMode="numeric"
                  type="text"
                  maxLength={10}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold text-sm sm:text-base 2xl:text-lg h-9 sm:h-10 lg:h-8'}
                  value={bet.number ?? ''}
                  onChange={(e) => handleNumericInput('number', e.target.value)}
                  onKeyDown={handleInputKeyDown(0)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center gap-1 sm:gap-2 lg:gap-0.5'}>
                <Label htmlFor={'amount'} className="text-sm sm:text-base 2xl:text-lg truncate"> Monto </Label>
                <Input
                  ref={amountRef}
                  id="amount"
                  name={'ticket-amount'}
                  type={'number'}
                  inputMode="numeric"
                  value={bet?.amount?.toString() ?? ''}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold text-sm sm:text-base 2xl:text-lg h-9 sm:h-10 lg:h-8'}
                  onChange={(e) => handleBet('amount', e.target.value)}
                  onKeyDown={handleInputKeyDown(1)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center gap-1 sm:gap-2 lg:gap-0.5'}>
                <Label htmlFor={'place'} className="text-sm sm:text-base 2xl:text-lg truncate"> Ubicación </Label>
                <Input
                  ref={placeRef}
                  id="place"
                  name={'ticket-place'}
                  type={'number'}
                  inputMode="numeric"
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold text-sm sm:text-base 2xl:text-lg h-9 sm:h-10 lg:h-8'}
                  value={bet.place ?? ''}
                  onChange={(e) => handleBet('place', e.target.value)}
                  onKeyDown={handleInputKeyDown(2)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center gap-1 sm:gap-2 lg:gap-0.5'}>
                <Label htmlFor={'with'} className="text-sm sm:text-base 2xl:text-lg truncate"> Con </Label>
                <Input
                  ref={withRef}
                  id="with"
                  name={'ticket-with'}
                  inputMode="numeric"
                  type="text"
                  maxLength={2}
                  value={bet.with ?? ''}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold text-sm sm:text-base 2xl:text-lg h-9 sm:h-10 lg:h-8'}
                  onChange={(e) => handleNumericInput('with', e.target.value)}
                  onKeyDown={handleInputKeyDown(3)}
                />
              </Box>
              <Box className={'grid grid-cols-2 items-center gap-1 sm:gap-2 lg:gap-0.5'}>
                <Label htmlFor={'position'} className="text-sm sm:text-base 2xl:text-lg truncate"> Posición </Label>
                <Input
                  ref={positionRef}
                  id="position"
                  name={'ticket-position'}
                  type={'number'}
                  inputMode="numeric"
                  value={bet.position ?? ''}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold text-sm sm:text-base 2xl:text-lg h-9 sm:h-10 lg:h-8'}
                  onChange={(e) => handleBet('position', e.target.value)}
                  onKeyDown={handleInputKeyDown(4)}
                />
              </Box>
              <Flex className={'gap-1 sm:gap-2 lg:gap-0.5 pt-2 lg:pt-0.5'}>
                <Button
                  type={'button'}
                  size="sm"
                  className={'flex-1 lg:h-7 lg:text-xs'}
                  disabled={!isAddButtonEnabled || !isEnabled}
                  onClick={() => handleCreateBet()}
                >
                  <PlusIcon className="hidden sm:inline sm:mr-1 lg:mr-0.5" /> <span>Agregar</span>
                </Button>
                <Button
                  type={'reset'}
                  variant={'outline'}
                  size="sm"
                  className={'flex-1 max-w-[100px] sm:max-w-[120px] lg:max-w-[90px] lg:h-7 lg:text-xs'}
                  onClick={() => handleDeleteForm()}
                >
                  <TrashIcon className="hidden sm:inline sm:mr-1 lg:mr-0.5" /> <span>Borrar</span>
                </Button>
              </Flex>
            </FlexCol>
          </form>
        </Flex>
        <GameTurns />
      </Flex>
    </FlexCol>
  );
};

export default FillOutATicket;
