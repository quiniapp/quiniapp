import { IScheduleLotteryEntityFront, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
export declare class ScheduleLotteryController {
  private repository;
  getAllScheduleLotteries(organization_id: string): Promise<IScheduleLotteryEntityFront>;
  deleteAllForScheduleAndDay({
    day,
    schedule_id,
    organization_id,
  }: {
    day: SCHEDULE_DAY;
    schedule_id: string;
    organization_id: string;
  }): Promise<void>;
  bulkInsert(
    props: {
      day: SCHEDULE_DAY;
      schedule_id: string;
      lottery_id: string;
      organization_id: string;
    }[],
    organization_id: string
  ): Promise<IScheduleLotteryEntityFront>;
  bulkActiveLotteries(lotteries: string[], organization_id: string): Promise<void>;
  saveScheduleLottery(
    scheduleLottery: IScheduleLotteryEntityFront,
    organization_id: string
  ): Promise<IScheduleLotteryEntityFront>;
  getLotteryIdsForDay(organization_id: string, day: SCHEDULE_DAY): Promise<string[]>;
  getScheduleIdsForDay(organization_id: string, day: SCHEDULE_DAY): Promise<string[]>;
  getLotteryIdsByScheduleAndDay(
    organization_id: string,
    schedule_id: string,
    day: SCHEDULE_DAY
  ): Promise<string[]>;
}
