import {
  IScheduleLotteryEntityBack,
  IScheduleLotteryEntityFront,
  SCHEDULE_DAY,
} from '@helper/types/schedule-lottery.type';
export declare class ScheduleLotteryRepository {
  getAllScheduleLottery(organization_id: string): Promise<IScheduleLotteryEntityBack[]>;
  deleteAllForScheduleAndDay({
    organization_id,
    day,
    schedule_id,
  }: {
    organization_id: string;
    day: SCHEDULE_DAY;
    schedule_id: string;
  }): Promise<void>;
  bulkInsert(
    records: {
      organization_id: string;
      day: SCHEDULE_DAY;
      schedule_id: string;
      lottery_id: string;
    }[]
  ): Promise<void>;
  saveScheduleLottery(
    scheduleLottery: IScheduleLotteryEntityFront,
    organization_id: string
  ): Promise<void>;
  bulkActiveLotteries(lotteries: string[], organization_id: string): Promise<void>;
  getScheduleLotteriesByDay(
    organization_id: string,
    day: SCHEDULE_DAY
  ): Promise<IScheduleLotteryEntityBack[]>;
  getScheduleLotteriesByScheduleAndDay(
    organization_id: string,
    schedule_id: string,
    day: SCHEDULE_DAY
  ): Promise<IScheduleLotteryEntityBack[]>;
}
