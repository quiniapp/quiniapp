import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { IBetTable, IBetTableBase, ILotterySchedule } from '@helper/request/ticket.request';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';

dayjs.extend(utc);
dayjs.extend(timezone);
export const betBase = (bet: IBetTable): IBetTableBase => {
  return {
    ...bet,
    scheduleLottery: bet.scheduleLottery.map((schLot: ILotterySchedule) => {
      const schedule: IScheduleEntityFront = schLot.schedule;
      return {
        schedule: schedule.schedule_id,
        lotteries: schLot.lotteries.map((lot: ILotteryEntityFront) => lot.lottery_id),
      };
    }),
  };
};
