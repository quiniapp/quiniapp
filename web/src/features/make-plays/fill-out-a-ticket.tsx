import { PlusIcon, TrashIcon } from 'lucide-react';
import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import GameTurns from '@/features/make-plays/game-turns';
import { PLACE_TYPE } from '@helper/types/bet.type';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { placeTypeParse } from '@helper/functions/placeTypeParse';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import dayjs from 'dayjs';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { dayParseToString } from '@helper/functions/dayDictionary';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.response';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';

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

const FillOutATicket = ({
  setTotalAmount,
  setPartialAmount,
  setBets,
  lotteries,
  setLotteries,
  schedules,
  setSchedules,
  isEnabled,
  setIsEnabledCreateBet,
}: {
  setTotalAmount: React.Dispatch<React.SetStateAction<number>>;
  setPartialAmount: React.Dispatch<React.SetStateAction<number>>;
  setBets: React.Dispatch<React.SetStateAction<IBetTable[]>>;
  lotteries: Map<string, ILotteryEntityFront>;
  setLotteries: React.Dispatch<React.SetStateAction<Map<string, ILotteryEntityFront>>>;
  schedules: Map<string, IScheduleEntityFront>;
  setSchedules: React.Dispatch<React.SetStateAction<Map<string, IScheduleEntityFront>>>;
  isEnabled: boolean;
  setIsEnabledCreateBet: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const today = dayjs().day();
  const [openModal, setOpenModal] = useState<boolean>(false);
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

  // Índices de orden según tus arrays "order"

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
          bet.number.length === 2)) &&
      schedules.size &&
      lotteries.size
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
                  inputMode="numeric"
                  type={'string'}
                  maxLength={10}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold '}
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
                  inputMode="numeric"
                  value={bet?.amount ?? ''}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold '}
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
                  inputMode="numeric"
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold '}
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
                  inputMode="numeric"
                  type={'string'}
                  maxLength={2}
                  value={bet.with}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold '}
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
                  inputMode="numeric"
                  value={bet.position}
                  className={'bg-[var(--bg-card)] text-slate-200 font-semibold '}
                  onChange={(e) => handleBet('position', e.target.value)}
                  onKeyDown={handleInputKeyDown(4)}
                />
              </Box>
              <Flex className={' gap-2 py-2'}>
                <Button
                  type={'button'}
                  className={'flex-1 disabled:bg-pink-50'}
                  disabled={!isAddButtonEnabled || !isEnabled}
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
        <GameTurns
          checkedLotteries={lotteries}
          checkedSchedules={schedules}
          setLotteries={handleLotteries}
          setSchedules={handleSchedules}
          setIsEnabledCreateBet={setIsEnabledCreateBet}
        />
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

const ResetPartialModal = React.lazy(() => import('../../components/modals/ResetPartialModal'));
