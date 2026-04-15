import { dayParseToString } from '@helper/functions/dayDictionary';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import { useEffect, useMemo } from 'react';

import { Flex } from '@/components/flex';
import { useAuth } from '@/contexts/AuthContext';
import ScheduleCheckboxList from '@/features/make-plays/schedules-checkbox-list';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { useClockFunctions } from '@/providers/ClockProvider';

import { usePlayDetails } from './context/MakePlaysContext';
import LotteriesCheckboxList from './lotteries-checkbox-list';



const GameTurns = () => {
  const {
    lotteries: checkedLotteries,
    schedules: checkedSchedules,
    setLotteries,
    setSchedules,
    setIsEnabledCreateBet,
  } = usePlayDetails();

  const today = dayjs().day();
  const handleSchedules = (schedule: IScheduleEntityFront) => {
    setSchedules((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(schedule.schedule_id)) {
        newMap.delete(schedule.schedule_id);
      } else {
        newMap.set(schedule.schedule_id, schedule);
      }
      return newMap;
    });
  };

  const handleLotteries = (lottery: ILotteryEntityFront) => {
    setLotteries((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(lottery.lottery_id)) {
        newMap.delete(lottery.lottery_id);
      } else {
        newMap.set(lottery.lottery_id, lottery);
      }
      return newMap;
    });
  };
  const { isScheduleAfter, isLessThanTenMinutes } = useClockFunctions();
  const { role } = useAuth();

  const todayKey: DayKey = useMemo(() => dayParseToString[today], [today]);

  // Fetch schedules y lotteries filtrados por día desde el backend
  const { data: schedulesData = [] } = useSchedules({ day: todayKey });
  const { data: allLotteries = [] } = useLotteries({ day: todayKey });
  const { data: scheduleLotteryPerDate } = useScheduleLottery();

  // Los schedules ya vienen filtrados del backend (solo los que tienen loterías hoy)
  const schedulesAvailables = schedulesData;

  // Filtrar loterías basadas en los turnos seleccionados
  const availableLotteries = useMemo(() => {
    // Si no hay turnos seleccionados, no mostrar loterías
    if (checkedSchedules.size === 0) return [];

    const daySchedules = scheduleLotteryPerDate?.[todayKey];
    if (!daySchedules) return [];

    // Obtener IDs de loterías de todos los turnos seleccionados
    const lotteryIds = new Set<string>();
    checkedSchedules.forEach((schedule) => {
      const scheduleLotteries = daySchedules[schedule.schedule_id];
      if (scheduleLotteries) {
        scheduleLotteries.forEach((id) => lotteryIds.add(id));
      }
    });

    // Filtrar loterías completas que están en los turnos seleccionados
    // allLotteries ya viene filtrado por día desde el backend
    return allLotteries.filter((lottery) => lotteryIds.has(lottery.lottery_id));
  }, [checkedSchedules, scheduleLotteryPerDate, todayKey, allLotteries]);

  useEffect(() => {
    const check = () => {
      // Auto-deselect closed schedules for CASHIERs
      if (role === USER_TYPE.CASHIER) {
        setSchedules((prev) => {
          let changed = false;
          const newMap = new Map(prev);
          prev.forEach((sch) => {
            const stillOpen = isScheduleAfter(sch.time) && !isLessThanTenMinutes(sch.time);
            if (!stillOpen) {
              newMap.delete(sch.schedule_id);
              changed = true;
            }
          });
          return changed ? newMap : prev;
        });
      }

      // isLessThanTenMinutes returns false for past times (diffSec < 0), so
      // we also need isScheduleAfter to properly detect closed schedules.
      const hasOpenSchedule =
        schedulesData?.some(
          (sch: IScheduleEntityFront) =>
            isScheduleAfter(sch.time) && !isLessThanTenMinutes(sch.time)
        ) ?? false;
      setIsEnabledCreateBet(role !== USER_TYPE.CASHIER || hasOpenSchedule);
    };
    check();
    // Re-check every 10s — more than enough for a 10-minute threshold.
    const id = window.setInterval(check, 10_000);
    return () => clearInterval(id);
  }, [schedulesData, isScheduleAfter, isLessThanTenMinutes, role, setIsEnabledCreateBet, setSchedules]);

  // Limpiar loterías seleccionadas que ya no están disponibles
  useEffect(() => {
    const availableIds = new Set(availableLotteries.map((lot) => lot.lottery_id));

    // Remover loterías que ya no están disponibles
    setLotteries((prev) => {
      const newMap = new Map(prev);
      let changed = false;

      prev.forEach((_lottery, id) => {
        if (!availableIds.has(id)) {
          newMap.delete(id);
          changed = true;
        }
      });

      return changed ? newMap : prev;
    });
  }, [availableLotteries, setLotteries]);

  return (
    <Flex className="grid grid-cols-2 gap-2 lg:gap-1.5 sm:flex sm:flex-col 1440:space-y-5 sm:flex-1 sm:justify-between">
      <ScheduleCheckboxList
        schedules={schedulesAvailables}
        setSchedules={handleSchedules}
        checkedSchedules={checkedSchedules}
      />

      <LotteriesCheckboxList
        lotteries={availableLotteries}
        checkedLotteries={checkedLotteries}
        setLotteries={handleLotteries}
      />
    </Flex>
  );
};

export default GameTurns;
