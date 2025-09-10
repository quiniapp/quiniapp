import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import Modal from '@/components/modals/custom-modal.tsx';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { QuinielaFieldset } from '@/features/play-details/quiniela-fieldset.tsx';
import { useEffect, useMemo, useState } from 'react';
import { getTicketByNumber } from '@/hooks/fetchs/tickets/useGetByNumber';
import { IBetTable } from '@/features/play-details';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '@/lib/utils';
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import dayjs from 'dayjs';
import { useSchedules } from '@/hooks/useSchedules';
import { dayParseToString } from '../../../../helper/functions/dayDictionary';
import { DayKey } from '../../../../helper/types/schedule-lottery.type';
import { IScheduleEntityFront } from 'helper/types/schedule.type';

interface BasicModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  handleRecreateBet: (values: IBetTable[]) => void;
}

const RepeatTicketModal = ({ isOpen, title, onClose, handleRecreateBet }: BasicModalProps) => {
  if (!isOpen) return null;

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

const selectedBets = useMemo<IBetTable[]>(() => {
  // Para CADA bet, generamos la combinatoria a partir de lo seleccionado,
  // no a partir de lo que ya existía en la bet original.
  return Array.from(repeatBets.values())
    .map((b) => {
      const newSL: IBetTable['scheduleLottery'] = [];

      scheduleLotteriesToPlay.forEach((lotIds, schId) => {
        if (!lotIds || lotIds.size === 0) return;

        const schedule = schedulesById.get(schId);
        if (!schedule) return; // si no tenés el schedule, salteá (o podrías crear uno mínimo)

        // mapear los ids seleccionados a objetos lottery; si alguno no existe, crear objeto mínimo
        const lotteries = Array.from(lotIds).map((id) => {
          const lot = lotteryById.get(id);
          return lot ?? ({ lottery_id: id } as any);
        });

        if (lotteries.length > 0) {
          newSL.push({ schedule, lotteries });
        }
      });

      return { ...b, scheduleLottery: newSL };
    })
    .filter((b) => b.scheduleLottery.length > 0);
}, [repeatBets, scheduleLotteriesToPlay, schedulesById, lotteryById]);



  const selectedTotal = useMemo(() => {
    return selectedBets.reduce((acc, b) => {
      const lotCount = b.scheduleLottery.reduce((c, s) => c + s.lotteries.length, 0);
      const amount = typeof b.amount === 'string' ? parseFloat(b.amount) : (b.amount ?? 0);
      return acc + amount * lotCount;
    }, 0);
  }, [selectedBets]);

  useEffect(() => {
    if (!data) return;

    const betsByNumber = new Map<string, IBetTable>();
    const selectedBySchedule = new Map<string, Set<string>>();

    for (const b of data.bets) {
      const num = b.number;
      const schId = b.schedule.schedule_id;
      const lotId = String(b.lottery_id);

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
  const handleToggleLottery = (scheduleId: string, lotteryId: string) => {
    setScheduleLotteriesToPlay((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(scheduleId) ?? []);
      set.has(lotteryId) ? set.delete(lotteryId) : set.add(lotteryId);
      copy.set(scheduleId, set);
      return copy;
    });
  };

  const handleToggleAllForSchedule = (scheduleId: string, allIds: string[], checked: boolean) => {
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
      const ids = scheduleLottery?.[todayKey]?.[sch.schedule_id] ?? [];
      map.set(sch.schedule_id, new Set(ids));
    }
    setScheduleLotteriesToPlay(map);
  };

  const handleClearAllAllSchedules = () => {
    setScheduleLotteriesToPlay(new Map());
  };

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
        {schedules?.map((sch) => {
          const available = scheduleLottery?.[todayKey]?.[sch.schedule_id] ?? []; // lottery_ids habilitadas hoy
          const selected = scheduleLotteriesToPlay.get(sch.schedule_id) ?? new Set<string>();
          return (
            <QuinielaFieldset
              key={sch.schedule_id}
              legend={`${sch.name}-${sch.time.slice(0, 5)}`}
              namePrefix="tone"
              schedule={sch}
              availableLotteryIds={available}
              selectedLotteryIds={selected}
              onToggleLottery={(lotId) => handleToggleLottery(sch.schedule_id, lotId)}
              onToggleAll={(checked) =>
                handleToggleAllForSchedule(sch.schedule_id, available, checked)
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
