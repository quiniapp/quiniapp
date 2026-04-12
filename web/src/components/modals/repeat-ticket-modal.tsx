import Modal from '@/components/modals/custom-modal.tsx';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { QuinielaFieldset } from '@/features/make-plays/quiniela-fieldset';
import { useEffect, useMemo, useState } from 'react';
import { getTicketByNumber } from '@/hooks/fetchs/tickets/useGetTicketByNumber';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import dayjs from 'dayjs';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { dayParseToString } from '@helper/functions/dayDictionary';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useClock, useClockFunctions } from '@/providers/ClockProvider';
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
  const { time } = useClock();
  const { isScheduleEnabled, isLessThanTenMinutes } = useClockFunctions();

  const todayIdx = dayjs().day();
  const todayKey: DayKey = dayParseToString[todayIdx];
  const [repeatBets, setRepeatBets] = useState<Map<string, IBetTable>>(new Map());
  const [scheduleLotteriesToPlay, setScheduleLotteriesToPlay] = useState<Map<string, Set<string>>>(
    new Map()
  );
  const [ticketNumber, setTicketNumber] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number | null>(null);
  const { data: schedules } = useSchedules();
  const { data: scheduleLottery } = useScheduleLottery();
  const { data: lotteries } = useLotteries({ all: true });
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

  const lotteriesById = useMemo(() => {
    const map = new Map<string, ILotteryEntityFront>();
    (lotteries ?? []).forEach((l) => map.set(l.lottery_id, l));
    return map;
  }, [lotteries]);


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

          const lotteries = Array.from(lotIds)
            .map((id) => lotteriesById.get(id))
            .filter((lot): lot is ILotteryEntityFront => lot !== undefined);
          if (lotteries.length > 0) newSL.push({ schedule, lotteries });
        });

        const amount = customAmount !== null ? customAmount : b.amount;
        return { ...b, amount, scheduleLottery: newSL };
      })
      .filter((b) => b.scheduleLottery.length > 0);
  }, [repeatBets, scheduleLotteriesToPlay, schedulesById, lotteriesById, disabledSchedules, customAmount]);

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
  // Solo ejecutar cuando cambia el ticket o cuando se cargan por primera vez los datos necesarios
  if (!data || !scheduleLottery || !schedules || !lotteriesById || lotteriesById.size === 0) {
    // Limpiar cuando no hay ticket
    if (!data) {
      setRepeatBets(new Map());
      setScheduleLotteriesToPlay(new Map());
    }
    return;
  }

  const betsByKey = new Map<string, IBetTable>();
  const selectedBySchedule = new Map<string, Set<string>>();

  // 1. Crear índice de schedules por ID para búsqueda rápida
  const schedulesMap = new Map<string, IScheduleEntityFront>();
  schedules.forEach((sch) => schedulesMap.set(sch.schedule_id, sch));

  // 2. Procesar cada bet usando bet_order como clave única
  for (const bet of data.bets) {
    // Usar bet_order como clave única (cada bet_order representa una jugada original)
    const betKey = String(bet.bet_order);

    // Si ya procesamos esta jugada, saltearla (evitar duplicados)
    if (betsByKey.has(betKey)) continue;

    // 3. Regenerar scheduleLottery basándose en las lotteries de ESTA bet que ESTÁN DISPONIBLES ahora
    const newScheduleLottery: IBetTable['scheduleLottery'] = [];

    // Iterar sobre los schedules que estaban en ESTA bet específica
    for (const sl of bet.scheduleLottery) {
      const originalSchId = sl.schedule.schedule_id;
      const originalLotteryIds = new Set(sl.lotteries.map((l) => l.lottery_id));

      // Obtener las lotteries disponibles AHORA para este schedule
      const availableLotteryIds = scheduleLottery[todayKey]?.[originalSchId] ?? [];

      // Intersección: lotteries de esta bet que están disponibles AHORA
      const matchingLotteryIds = availableLotteryIds.filter((id) => originalLotteryIds.has(id));

      // Si no hay coincidencias, saltar este schedule
      if (matchingLotteryIds.length === 0) continue;

      // Obtener el schedule actual
      const currentSchedule = schedulesMap.get(originalSchId);
      if (!currentSchedule) continue;

      // Mapear IDs a objetos completos usando lotteriesById
      const lotteries = matchingLotteryIds
        .map((lotId) => lotteriesById.get(lotId))
        .filter((lot): lot is ILotteryEntityFront => lot !== undefined);

      if (lotteries.length === 0) continue;

      newScheduleLottery.push({
        schedule: currentSchedule,
        lotteries: lotteries,
      });
    }

    // 4. Crear la apuesta con campos básicos y scheduleLottery regenerado
    const basicBet: IBetTable = {
      bet_order: bet.bet_order,
      number: bet.number,
      amount: bet.amount,
      place: bet.place,
      with: bet.with ?? null,
      position: bet.position ?? null,
      scheduleLottery: newScheduleLottery,
    };

    betsByKey.set(betKey, basicBet);
  }

  // 5. Pre-seleccionar solo las lotteries que están en newScheduleLottery (ya filtradas)
  for (const bet of betsByKey.values()) {
    for (const sl of bet.scheduleLottery) {
      const schId = sl.schedule.schedule_id;

      // Saltar schedules deshabilitados
      if (disabledSchedules.has(schId)) continue;

      if (!selectedBySchedule.has(schId)) {
        selectedBySchedule.set(schId, new Set());
      }

      for (const lot of sl.lotteries) {
        selectedBySchedule.get(schId)!.add(lot.lottery_id);
      }
    }
  }

  setRepeatBets(betsByKey);
  setScheduleLotteriesToPlay(selectedBySchedule);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [data, ticketNumber]);


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
      className="!max-w-[1024px] w-full m-auto bg-[#060813] p-2 sm:p-4 md:p-6 !max-h-[95vh] flex flex-col !gap-0 overflow-y-scroll"
    >
      {/* Contenedor con scroll - Todo excepto los botones */}
      <div className="overflow-y-auto flex-1 pr-1 -mr-1 min-h-[200px]">
        {/* Input de Ticket y Monto - Layout Responsive */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Text size="sm" weight="medium" className="text-slate-200 whitespace-nowrap">
              Ticket N°:
            </Text>
            <Input
              type="number"
              value={ticketNumber}
              onChange={(e) => {
                setTicketNumber(e.target.value);
                setCustomAmount(null);
              }}
              className="w-full sm:w-64"
              placeholder="Ingrese el número de ticket"
            />
            <Text size="sm" weight="medium" className="text-slate-200 whitespace-nowrap">
              Monto:
            </Text>
            <Input
              type="number"
              value={customAmount ?? ''}
              onChange={(e) => setCustomAmount(e.target.value ? Number(e.target.value) : null)}
              className="w-full sm:w-32"
              placeholder="Original"
            />
          </div>
        </div>

        {/* Grid de Quiniela Fieldsets - Responsive */}
        <div className="mb-4 sm:mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
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
                  namePrefix={`repeat-${sch.schedule_id}`}
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
        <div className="mb-4 sm:mb-6 bg-slate-800/30 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center">
              <Text size="lg" weight="semibold" className="text-slate-100">
                Total: <span className="text-green-400">${selectedTotal.toFixed(2)}</span>
              </Text>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                className="w-full sm:w-auto text-xs sm:text-sm py-2"
                onClick={handleSelectAllAllSchedules}
              >
                Seleccionar todas
              </Button>
              <Button
                variant="outline"
                type="button"
                className="w-full sm:w-auto text-xs sm:text-sm py-2"
                onClick={handleClearAllAllSchedules}
              >
                Quitar todas
              </Button>
            </div>
          </div>
        </div>

        {/* Tabla Desktop / Cards Mobile */}
        <div className="mb-4 sm:mb-6">
          {/* Vista de Tabla - Solo Desktop */}
          <div className="hidden md:block rounded-lg border border-slate-700">
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
                {Array.from(repeatBets.values()).map((bet) => (
                  <TableRow key={bet.bet_order} className="text-slate-300 hover:bg-slate-800/50">
                    <TableCell className="font-medium">{bet.number}</TableCell>
                    <TableCell>{bet.with || '-'}</TableCell>
                    <TableCell>${customAmount ?? bet.amount}</TableCell>
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
          <div className="md:hidden space-y-2 sm:space-y-3">
            {Array.from(repeatBets.values()).map((bet) => (
              <div
                key={bet.bet_order}
                className="bg-slate-800/40 rounded-lg p-3 border border-slate-700 space-y-2"
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
                      ${customAmount ?? bet.amount}
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
                  <div className="space-y-0.5">
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
      </div>

      {/* Botones de Acción - Siempre visibles */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-3 sm:pt-4 border-t border-slate-700 mt-3 sm:mt-4 flex-shrink-0">
        <Button
          variant="outline"
          className="w-full sm:w-auto sm:min-w-[140px] text-sm py-2"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          variant="default"
          className="w-full sm:w-auto sm:min-w-[140px] text-sm py-2"
          onClick={handleSetBets}
        >
          Agregar Jugadas
        </Button>
      </div>
    </Modal>
  );
};

export default RepeatTicketModal;
