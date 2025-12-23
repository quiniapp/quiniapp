import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import Modal from '@/components/modals/custom-modal.tsx';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { QuinielaFieldset } from '@/features/make-plays/quiniela-fieldset';
import { useEffect, useMemo, useState } from 'react';
import { getTicketByNumber } from '@/hooks/fetchs/tickets/useGetTicketByNumber';
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
import { IBetTable } from '@helper/request/ticket.request';

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

  for (const bet of data.bets) {
    const num = bet.number;

    // recorro los schedules anidados
    for (const sl of bet.scheduleLottery) {
      const schId = sl.schedule.schedule_id;
      if (disabledSchedules.has(schId)) continue;

      // preselección: todas las lotteries de ese schedule
      if (!selectedBySchedule.has(schId)) selectedBySchedule.set(schId, new Set());
      for (const lot of sl.lotteries) {
        selectedBySchedule.get(schId)!.add(lot.lottery_id);
      }

      // agrupar jugadas por número y mergear schedule/lotteries
      const existing = betsByNumber.get(num);
      if (existing) {
        let entry = existing.scheduleLottery.find((s) => s.schedule.schedule_id === schId);
        if (!entry) {
          entry = { schedule: sl.schedule, lotteries: [] };
          existing.scheduleLottery.push(entry);
        }
        // merge sin duplicados
        const existingIds = new Set(entry.lotteries.map((l) => l.lottery_id));
        for (const lot of sl.lotteries) {
          if (!existingIds.has(lot.lottery_id)) entry.lotteries.push(lot);
        }
      } else {
        // primer vez: clono la estructura de scheduleLottery del bet
        betsByNumber.set(num, {
          number: bet.number,
          amount: bet.amount,
          place: bet.place,
          with: bet.with ?? null,
          position: bet.position ?? null,
          scheduleLottery: [{ schedule: sl.schedule, lotteries: [...sl.lotteries] }],
        });
      }
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
      className="!max-w-[1024px] w-full m-auto bg-[#060813] p-3 sm:p-6"
    >
      {/* Input de Ticket - Layout Responsive */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Text size="sm" weight="medium" className="text-slate-200 whitespace-nowrap">
            Ticket N°:
          </Text>
          <Input
            type="number"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            className="w-full sm:w-64"
            placeholder="Ingrese el número de ticket"
          />
        </div>
      </div>

      {/* Grid de Quiniela Fieldsets - Responsive */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {(schedules ?? []).map((sch) => {
            const isDisabled = disabledSchedules.has(sch.schedule_id);
            const availableRaw = scheduleLottery?.[todayKey]?.[sch.schedule_id] ?? [];
            const available = isDisabled ? [] : availableRaw;

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
        </div>
      </div>

      {/* Sección de Total y Botones de Selección */}
      <div className="mb-6 bg-slate-800/30 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center">
            <Text size="lg" weight="semibold" className="text-slate-100">
              Total: <span className="text-green-400">${selectedTotal.toFixed(2)}</span>
            </Text>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              type="button"
              className="w-full sm:w-auto"
              onClick={handleSelectAllAllSchedules}
            >
              Seleccionar todas
            </Button>
            <Button
              variant="outline"
              type="button"
              className="w-full sm:w-auto"
              onClick={handleClearAllAllSchedules}
            >
              Quitar todas
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla Desktop / Cards Mobile */}
      <div className="mb-6">
        {/* Vista de Tabla - Solo Desktop */}
        <div className="hidden md:block overflow-y-auto max-h-96 rounded-lg border border-slate-700">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-800/95 z-10">
              <TableRow>
                <TableHead className="text-slate-200">Jugada</TableHead>
                <TableHead className="text-slate-200">Con</TableHead>
                <TableHead className="text-slate-200">Monto</TableHead>
                <TableHead className="text-slate-200">Tipo</TableHead>
                <TableHead className="text-slate-200">Horario/Lotería</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(repeatBets.values()).map((bet, index) => (
                <TableRow key={index} className="text-slate-300 hover:bg-slate-800/50">
                  <TableCell className="font-medium">{bet.number}</TableCell>
                  <TableCell>{bet.with || '-'}</TableCell>
                  <TableCell>${bet.amount}</TableCell>
                  <TableCell>
                    {betPlaceDictionary[bet.place]}
                    {bet?.position ? ` ${betPlaceDictionary[bet.position]}` : ''}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words text-sm">
                    {bet.scheduleLottery.map((lotSched, idx) => (
                      <span key={idx} className="block mb-1">
                        {lotSched.schedule.name} - [{lotSched.lotteries.map((lot) => lot.name).join(', ')}]
                      </span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Vista de Cards - Solo Mobile */}
        <div className="md:hidden space-y-3 max-h-96 overflow-y-auto">
          {Array.from(repeatBets.values()).map((bet, index) => (
            <div
              key={index}
              className="bg-slate-800/40 rounded-lg p-4 border border-slate-700 space-y-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <Text size="xs" className="text-slate-400 uppercase tracking-wide">
                    Jugada
                  </Text>
                  <Text size="lg" weight="bold" className="text-slate-100">
                    {bet.number}
                  </Text>
                </div>
                <div className="text-right">
                  <Text size="xs" className="text-slate-400 uppercase tracking-wide">
                    Monto
                  </Text>
                  <Text size="lg" weight="semibold" className="text-green-400">
                    ${bet.amount}
                  </Text>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
                <div>
                  <Text size="xs" className="text-slate-400">
                    Con:
                  </Text>
                  <Text size="sm" className="text-slate-200">
                    {bet.with || '-'}
                  </Text>
                </div>
                <div>
                  <Text size="xs" className="text-slate-400">
                    Tipo:
                  </Text>
                  <Text size="sm" className="text-slate-200">
                    {betPlaceDictionary[bet.place]}
                    {bet?.position ? ` ${betPlaceDictionary[bet.position]}` : ''}
                  </Text>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700">
                <Text size="xs" className="text-slate-400 mb-1">
                  Horario/Lotería:
                </Text>
                <div className="space-y-1">
                  {bet.scheduleLottery.map((lotSched, idx) => (
                    <Text key={idx} size="xs" className="text-slate-300 block">
                      {lotSched.schedule.name} - [{lotSched.lotteries.map((lot) => lot.name).join(', ')}]
                    </Text>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-4 border-t border-slate-700">
        <Button
          variant="outline"
          className="w-full sm:w-auto sm:min-w-[140px]"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          variant="default"
          className="w-full sm:w-auto sm:min-w-[140px]"
          onClick={handleSetBets}
        >
          Agregar Jugadas
        </Button>
      </div>
    </Modal>
  );
};

export default RepeatTicketModal;
