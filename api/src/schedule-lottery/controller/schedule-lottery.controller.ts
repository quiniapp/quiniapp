import { parseScheduleLottery } from '../helper/parseScheduleLottery';
import { ScheduleLotteryRepository } from '../repository/schedule-lottery.repositroy';
import { IScheduleLotteryEntityFront, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class ScheduleLotteryController {
  private repository = new ScheduleLotteryRepository();
  async getAllScheduleLotteries(): Promise<IScheduleLotteryEntityFront> {
    const response = await this.repository.getAllScheduleLottery();
    return parseScheduleLottery(response);
  }

  async deleteAllForScheduleAndDay({
    day,
    schedule_id,
  }: {
    day: SCHEDULE_DAY;
    schedule_id: string;
  }): Promise<void> {
    try {
      return await this.repository.deleteAllForScheduleAndDay({ day, schedule_id });
    } catch (error) {
      console.error('getAllLotterySchedules:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async bulkInsert(
    props: {
      day: SCHEDULE_DAY;
      schedule_id: string;
      lottery_id: string;
    }[]
  ): Promise<IScheduleLotteryEntityFront> {
    try {
      await this.repository.bulkInsert(props);
      return await this.getAllScheduleLotteries();
    } catch (error) {
      console.error('bulkInsert:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }
}
