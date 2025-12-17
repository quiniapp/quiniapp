import { Flex } from '@/components/flex';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import ScheduleCheckboxList from '@/features/make-plays/schedules-checkbox-list';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useClock } from '@/providers/ClockProvider';
import { useEffect, useMemo } from 'react';
import { USER_TYPE } from '@helper/types/user.type';
import { useAuth } from '@/contexts/AuthContext';
import LotteriesCheckboxList from './lotteries-checkbox-list';
import { usePlayDetails } from './context/MakePlaysContext';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { dayParseToString } from '@helper/functions/dayDictionary';
import dayjs from 'dayjs';

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
  const { now, isLessThanTenMinutes } = useClock();
  const { role } = useAuth();
  const { data: schedulesData } = useSchedules();
  const { data: scheduleLotteryPerDate } = useScheduleLottery();

  const schedulesAvailables = useMemo(() => {
    if (!schedulesData?.length) return [];

    const todayKey: DayKey = dayParseToString[today];
    const daySchedules = scheduleLotteryPerDate?.[todayKey]; // Record<string, string[]> | undefined
    if (!daySchedules) return [];

    const ids = new Set(Object.keys(daySchedules)); // schedule_id que tienen loterías hoy

    return schedulesData.filter((sch) => ids.has(sch.schedule_id));
  }, [schedulesData, scheduleLotteryPerDate, today]);

  useEffect(() => {
    const status = schedulesData?.some((sch: IScheduleEntityFront) =>
      isLessThanTenMinutes(sch.time)
    );
    setIsEnabledCreateBet(!status || role !== USER_TYPE.CASHIER);
  }, [now, schedulesData]);

  return (
    <Flex className="grid grid-cols-2 gap-2 lg:gap-1.5 sm:flex sm:flex-col 1440:space-y-5 sm:flex-1 sm:justify-between">
      <ScheduleCheckboxList
        schedules={schedulesAvailables}
        setSchedules={handleSchedules}
        checkedSchedules={checkedSchedules}
      />

      <LotteriesCheckboxList checkedLotteries={checkedLotteries} setLotteries={handleLotteries} />
    </Flex>
  );
};

export default GameTurns;
