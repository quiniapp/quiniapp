import { TicketIcon } from 'lucide-react';

import { FlexCol } from '@/components/flex';
import HeaderTitleSection from '@/components/header-title-section';

import { useLotteries } from '@/hooks/useLotteries.ts';
import { useSchedules } from '@/hooks/useSchedules.ts';
import ScheduleCheckboxList from '@/features/play-details/schedules-checkbox-list.tsx';
import LotteryCheckboxList from '@/features/play-details/lottery-checkbox-list.tsx';
import Box from '@/components/box';
import { LotteryType } from '@/types/lottery.type.ts';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';

interface IGameTurns {
  setLotteries: (lottery: ILotteryEntityFront) => void
  setSchedules: (schedule: IScheduleEntityFront) => void
}

const GameTurns = ({ setLotteries, setSchedules }: IGameTurns) => {
  const { data } = useLotteries();
  const { data: schedulesData } = useSchedules();
  const lotteries = data?.data?.lottery ?? [];
  const schedules = schedulesData?.data?.schedule ?? [];

  return (
    <FlexCol className="flex-col 1440:space-y-6 space-y-3 flex-1">
      <ScheduleCheckboxList schedules={schedules} setSchedules={setSchedules}/>
      <FlexCol className=" border-2 p-4 rounded-[--rounded-form]">
        <HeaderTitleSection title={'Quniela'} icon={<TicketIcon size="16px" />} variant={'small'} />
        <Box className="pt-2 grid grid-cols-5 gap-[12px]">
          {lotteries.map((lot: LotteryType) => (
            <LotteryCheckboxList key={lot.lottery_id} lottery={lot} setLotteries={setLotteries}/>
          ))}
        </Box>
      </FlexCol>
    </FlexCol>
  );
};

export default GameTurns;
