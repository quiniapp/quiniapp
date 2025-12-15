import { parseScheduleLottery } from '../helper/parseScheduleLottery';
import { ScheduleLotteryRepository } from '../repository/schedule-lottery.repositroy';
import { IScheduleLotteryEntityFront, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class ScheduleLotteryController {
  private repository = new ScheduleLotteryRepository();
  async getAllScheduleLotteries(organization_id: string): Promise<IScheduleLotteryEntityFront> {
    const response = await this.repository.getAllScheduleLottery(organization_id);
    return parseScheduleLottery(response);
  }

  async deleteAllForScheduleAndDay({
    day,
    schedule_id,
    organization_id,
  }: {
    day: SCHEDULE_DAY;
    schedule_id: string;
    organization_id: string;
  }): Promise<void> {
    try {
      return await this.repository.deleteAllForScheduleAndDay({
        day,
        schedule_id,
        organization_id,
      });
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
      organization_id: string;
    }[],
    organization_id: string
  ): Promise<IScheduleLotteryEntityFront> {
    try {
      await this.repository.bulkInsert(props);
      return await this.getAllScheduleLotteries(organization_id);
    } catch (error) {
      console.error('bulkInsert:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }
  async bulkActiveLotteries(lotteries: string[], organization_id: string): Promise<void> {
    try {
      await this.repository.bulkActiveLotteries(lotteries, organization_id);
    } catch (error) {
      console.error('bulkInsert:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }
}
