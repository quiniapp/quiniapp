import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import Modal from '@/components/modals/custom-modal.tsx';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { QuinielaFieldset } from '@/features/make-plays/quiniela-fieldset';
import { useEffect, useMemo, useState } from 'react';
import { getTicketByNumber } from '@/hooks/fetchs/tickets/useGetByNumber';
import { IBetTable } from '@/features/make-plays';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '@/lib/utils';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import dayjs from 'dayjs';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { dayParseToString } from '@helper/functions/dayDictionary';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { USER_TYPE } from '@helper/types/user.type';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useClock } from '@/providers/ClockProvider';
import { useAuth } from '@/contexts/AuthContext';

dayjs.extend(customParseFormat);
const toHHMMSS = (t: string) => (t.length === 5 ? `${t}:00` : t);
interface BasicModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  handleRecreateBet: (values: IBetTable[]) => void;
}

const RepeatTicketModal = ({ isOpen, title, onClose, handleRecreateBet }: BasicModalProps) => {
  if (!isOpen) return null;

  const { user } = useAuth();
  const isCashier = user?.user_type === USER_TYPE.CASHIER;
  const { time, isScheduleEnabled, isLessThanTenMinutes } = useClock();

  const todayIdx = dayjs().day();
  const todayKey: DayKey = dayParseToString[todayIdx];
  const [repeatBets, setRepeatBets] = useState<Map<string, IBetTable>>(new Map());
  const [scheduleLotteriesToPlay, setScheduleLotteriesToPlay] = useState<Map<string, Set<string>>>(
    new Map()
  );
  const [ticketNumber, setTicketNumber] = useState<string>('');
  const { data: schedules } = useSchedules();
  const { data: scheduleLottery } = useScheduleLottery();
  const { data } = getTicketByNumber(ticketNumber);
  console.log('data',data)
  const handleSetBets = () => {
    handleRecreateBet(selectedBets);
    onClose();
  };

  // índices auxiliares
  const schedulesById = useMemo(() => {
    const map = new Map<string, IScheduleEntityFront>();
    (schedules ?? []).forEach((s) => map.set(s.schedule_id, s));
    return map;
  }, [schedules]);

  const lotteryById = useMemo(() => {
    // recolecta cualquier lottery conocida de las bets existentes
    const map = new Map<string, { lottery_id: string; name?: string }>();
    repeatBets.forEach((b) => {
      b.scheduleLottery.forEach((sl) => {
        sl.lotteries.forEach((lot) => {
          map.set(lot.lottery_id, lot);
        });
      });
    });
    return map;
  }, [repeatBets]);

  const disabledSchedules = useMemo(() => {
    if (!isCashier) return new Set<string>();
    const set = new Set<string>();
    (schedules ?? []).forEach((sch) => {
      const hhmmss = toHHMMSS(sch.time);
      const enabled = isScheduleEnabled(hhmmss, 10); // windowMin = 0 → deshabilita apenas llega la hora
      if (!enabled) set.add(sch.schedule_id);
    });
    return set;
  }, [isCashier, schedules, isScheduleEnabled, time]);

  const selectedBets = useMemo<IBetTable[]>(() => {
    return Array.from(repeatBets.values())
      .map((b) => {
        const newSL: IBetTable['scheduleLottery'] = [];

        scheduleLotteriesToPlay.forEach((lotIds, schId) => {
          if (disabledSchedules.has(schId)) return; // ⬅️ filtro clave
          if (!lotIds || lotIds.size === 0) return;

          const schedule = schedulesById.get(schId);
          if (!schedule) return;

          const lotteries = Array.from(lotIds).map(
            (id) => lotteryById.get(id) ?? ({ lottery_id: id } as any)
          );
          if (lotteries.length > 0) newSL.push({ schedule, lotteries });
        });

        return { ...b, scheduleLottery: newSL };
      })
      .filter((b) => b.scheduleLottery.length > 0);
  }, [repeatBets, scheduleLotteriesToPlay, schedulesById, lotteryById, disabledSchedules]); // ⬅️ agregar dependencia

  const selectedTotal = useMemo(() => {
    return selectedBets.reduce((acc, b) => {
      const lotCount = b.scheduleLottery.reduce((c, s) => c + s.lotteries.length, 0);
      const amount = typeof b.amount === 'string' ? parseFloat(b.amount) : (b.amount ?? 0);
      return acc + amount * lotCount;
    }, 0);
  }, [selectedBets]);
  ////////////////
  const handleToggleLottery = (scheduleId: string, lotteryId: string) => {
    if (disabledSchedules.has(scheduleId)) return;
    setScheduleLotteriesToPlay((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(scheduleId) ?? []);
      set.has(lotteryId) ? set.delete(lotteryId) : set.add(lotteryId);
      copy.set(scheduleId, set);
      return copy;
    });
  };

  const handleToggleAllForSchedule = (scheduleId: string, allIds: string[], checked: boolean) => {
    if (disabledSchedules.has(scheduleId)) return;
    setScheduleLotteriesToPlay((prev) => {
      const copy = new Map(prev);
      copy.set(scheduleId, checked ? new Set(allIds) : new Set());
      return copy;
    });
  };

  const handleSelectAllAllSchedules = () => {
    if (!scheduleLottery) return;
    const map = new Map<string, Set<string>>();
    for (const sch of schedules ?? []) {
      if (disabledSchedules.has(sch.schedule_id)) continue; // salteá cerrados
      const ids = scheduleLottery?.[todayKey]?.[sch.schedule_id] ?? [];
      map.set(sch.schedule_id, new Set(ids));
    }
    setScheduleLotteriesToPlay(map);
  };

  //////////////////

  const handleClearAllAllSchedules = () => {
    setScheduleLotteriesToPlay(new Map());
  };

  useEffect(() => {
    if (!data) return;

    const betsByNumber = new Map<string, IBetTable>();
    const selectedBySchedule = new Map<string, Set<string>>();

    for (const b of data.bets) {
      const num = b.number;
      const schId = b.schedule.schedule_id;
      const lotId = String(b.lottery_id);
      if (disabledSchedules.has(schId)) continue; // ⬅️ no sumar cerrados
      // preselección por turno/lot
      if (!selectedBySchedule.has(schId)) selectedBySchedule.set(schId, new Set());
      selectedBySchedule.get(schId)!.add(lotId);

      // agrupar jugadas por número con schedule/lottery
      const existing = betsByNumber.get(num);
      if (existing) {
        let entry = existing.scheduleLottery.find((s) => s.schedule.schedule_id === schId);
        if (!entry) {
          entry = { schedule: b.schedule, lotteries: [] };
          existing.scheduleLottery.push(entry);
        }
        if (!entry.lotteries.some((l) => l.lottery_id === lotId)) {
          entry.lotteries.push(b.lottery);
        }
      } else {
        betsByNumber.set(num, {
          number: b.number,
          amount: b.amount,
          place: b.place,
          with: b.with,
          position: b.position,
          scheduleLottery: [{ schedule: b.schedule, lotteries: [b.lottery] }],
        });
      }
    }

    setRepeatBets(betsByNumber);
    setScheduleLotteriesToPlay(selectedBySchedule);
  }, [data]);

  useEffect(() => {
    setScheduleLotteriesToPlay((prev) => {
      const copy = new Map(prev);
      for (const schId of copy.keys()) {
        if (disabledSchedules.has(schId)) copy.delete(schId);
      }
      return copy;
    });
  }, [disabledSchedules]);

  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      className="!max-w-[980px]  w-full m-auto bg-[#060813] p-1 sm:p-3"
    >
      <Box className={'grid grid-cols-[1fr_3fr_1fr_5fr] items-center gap-1 sm:gap-3'}>
        <Flex className={'justify-end'}>
          <Typography variant={'small'}> Ticket N°: </Typography>
        </Flex>
        <Input
          type={'number'}
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
        />
      </Box>
      <Flex className="p-1 sm:p-3 justify-center gap-1 sm:gap-3">
        {(schedules ?? []).map((sch) => {
          const isDisabled = disabledSchedules.has(sch.schedule_id);
          const availableRaw = scheduleLottery?.[todayKey]?.[sch.schedule_id] ?? [];
          const available = isDisabled ? [] : availableRaw;

          // opcional: destacar si faltan ≤10 min
          const nearClose =
            isCashier && !isDisabled && isLessThanTenMinutes(toHHMMSS(sch.time), 10);

          return (
            <QuinielaFieldset
              key={sch.schedule_id}
              legend={`${sch.name}-${sch.time.slice(0, 5)}${
                isDisabled ? ' (cerrado)' : nearClose ? ' (cierra pronto)' : ''
              }`}
              namePrefix="tone"
              schedule={sch}
              availableLotteryIds={available}
              selectedLotteryIds={scheduleLotteriesToPlay.get(sch.schedule_id) ?? new Set<string>()}
              onToggleLottery={(lotId) => handleToggleLottery(sch.schedule_id, lotId)}
              onToggleAll={(checked) =>
                handleToggleAllForSchedule(sch.schedule_id, availableRaw, checked)
              }
            />
          );
        })}
      </Flex>

      <FlexCol className={'gap-1 sm:gap-3 items-center'}>
        <Flex>
          <span className="min-w-52 ">Monto total: ${selectedTotal}</span>

          <Button
            variant="outline"
            type="button"
            className={'  flex justify-center'}
            onClick={handleSelectAllAllSchedules}
          >
            Selecionar todas
          </Button>
          <Button
            variant="outline"
            type="reset"
            className={'  flex justify-center'}
            onClick={handleClearAllAllSchedules}
          >
            Quitar todas
          </Button>
        </Flex>

        <div className="flex-1 overflow-y-auto min-h-40 max-h-60">
          <Table className=" ">
            <TableHeader>
              <TableRow>
                <TableHead>Jugada</TableHead>
                <TableHead>Con</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>JugadaT</TableHead>
                <TableHead>Jugada en/Turno</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {Array.from(repeatBets.values()).map((bet, index) => {
                return (
                  <TableRow
                    key={index}
                    className={cn('cursor-pointer select-none text-slate-300')}
                    // data-state={selectedIndexes.includes(index) ? 'selected' : undefined}
                    // onMouseDown={() => {
                    //   dragStarted.current = false;
                    //   setIsSelecting(true);
                    // }}
                    // onMouseMove={() => {
                    //   dragStarted.current = true;
                    // }}
                    // onMouseEnter={() => {
                    //   if (isSelecting) {
                    //     setSelectedIndexes(
                    //       (prev) =>
                    //         prev.includes(index)
                    //           ? prev.filter((i) => i !== index) // des-seleccionar
                    //           : [...prev, index] // seleccionar
                    //     );
                    //   }
                    // }}
                    // onClick={() => {
                    //   if (!dragStarted.current) {
                    //     setSelectedIndexes((prev) =>
                    //       prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                    //     );
                    //   }
                    // }}
                  >
                    <TableCell>{bet.number}</TableCell>
                    <TableCell>{bet.with}</TableCell>
                    <TableCell>{bet.amount}</TableCell>
                    <TableCell>{`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}</TableCell>
                    <TableCell className="whitespace-normal break-words">
                      <span>
                        {bet.scheduleLottery.map((lotSched) => {
                          return `${lotSched.schedule.name}-[${lotSched.lotteries.map((lot) => lot.name).join(', ')}] //`;
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Flex className={'gap-3'}>
          <Box>
            <Button variant={'default'} onClick={handleSetBets}>
              AGREGAR JUGADAS
            </Button>
          </Box>
          <Box>
            <Button
              variant={'outline'}
              className={'bg-black'}
              onClick={() => {
                onClose();
              }}
            >
              {' '}
              CANCELAR
            </Button>
          </Box>
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default RepeatTicketModal;
