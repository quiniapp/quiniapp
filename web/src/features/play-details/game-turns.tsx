import { TicketIcon } from 'lucide-react';

import { FlexCol } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';

import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import ScheduleCheckboxList from '@/features/play-details/schedules-checkbox-list.tsx';
import LotteryCheckboxList from '@/features/play-details/lottery-checkbox-list.tsx';
import Box from '@/components/box';
import { LotteryType } from '@/types/lottery.type.ts';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { useClock } from '@/providers/ClockProvider';
import { useEffect } from 'react';
import { USER_TYPE } from '../../../../helper/types/user.type';
import { useAuth } from '@/contexts/AuthContext';

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
  const { data: lotteries } = useLotteries();
  const { data: schedulesData } = useSchedules();

  useEffect(() => {
    const status = schedulesData?.some((sch: IScheduleEntityFront) =>
      isLessThanTenMinutes(sch.time)
    );
    setIsEnabledCreateBet(!status || role !== USER_TYPE.CASHIER);
  }, [now, schedulesData]);

  return (
    <FlexCol className="flex-col 1440:space-y-5 space-y-3 flex-1">
      <ScheduleCheckboxList
        schedules={schedulesData ?? []}
        setSchedules={setSchedules}
        checkedSchedules={checkedSchedules}
      />
      <FlexCol className=" border-2 p-4 rounded-[--rounded-form]">
        <HeaderTitleSection title={'Quniela'} icon={<TicketIcon size="16px" />} variant={'small'} />
        <Box className=" grid grid-flow-col grid-rows-3 gap-[12px] w-fit">
          {lotteries?.map((lot: LotteryType) => (
            <LotteryCheckboxList
              key={lot.lottery_id}
              lottery={lot}
              setLotteries={setLotteries}
              checkedLottery={checkedLotteries.has(lot.lottery_id)}
            />
          ))}
        </Box>
      </FlexCol>
    </FlexCol>
  );
};

export default GameTurns;
