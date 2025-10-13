import { Flex } from '@/components/flex';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import ScheduleCheckboxList from '@/features/make-plays/schedules-checkbox-list';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useClock } from '@/providers/ClockProvider';
import { useEffect } from 'react';
import { USER_TYPE } from '@helper/types/user.type';
import { useAuth } from '@/contexts/AuthContext';
import LotteriesCheckboxList from './lotteries-checkbox-list';

interface IGameTurns {
  setLotteries: (lottery: ILotteryEntityFront) => void;
  setSchedules: (schedule: IScheduleEntityFront) => void;
  checkedLotteries: Map<string, ILotteryEntityFront>;
  checkedSchedules: Map<string, IScheduleEntityFront>;

  setIsEnabledCreateBet: React.Dispatch<React.SetStateAction<boolean>>;
}

const GameTurns = ({
  setLotteries,
  setSchedules,
  checkedLotteries,
  checkedSchedules,
  setIsEnabledCreateBet,
}: IGameTurns) => {
  const { now, isLessThanTenMinutes } = useClock();
  const { role } = useAuth();
  const { data: schedulesData } = useSchedules();

  useEffect(() => {
    const status = schedulesData?.some((sch: IScheduleEntityFront) =>
      isLessThanTenMinutes(sch.time)
    );
    setIsEnabledCreateBet(!status || role !== USER_TYPE.CASHIER);
  }, [now, schedulesData]);

  return (
    <Flex className="grid grid-cols-2 gap-2 sm:flex sm:flex-col 1440:space-y-5  sm:flex-1 sm:justify-between">
      <ScheduleCheckboxList
        schedules={schedulesData ?? []}
        setSchedules={setSchedules}
        checkedSchedules={checkedSchedules}
      />

      <LotteriesCheckboxList checkedLotteries={checkedLotteries} setLotteries={setLotteries} />
    </Flex>
  );
};

export default GameTurns;
