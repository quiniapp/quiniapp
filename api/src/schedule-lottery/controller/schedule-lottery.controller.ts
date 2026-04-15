import { parseScheduleLottery } from '../helper/parseScheduleLottery';
import { ScheduleLotteryRepository } from '../repository/schedule-lottery.repositroy';
import {
  IScheduleLotteryEntityBack,
  IScheduleLotteryEntityFront,
  SCHEDULE_DAY,
} from '@helper/types/schedule-lottery.type';
import { globalCacheManager } from 'src/cache/CacheManager';
import {
  getScheduleLotteryCacheKey,
  invalidateScheduleLotteryRelated,
} from 'src/cache/cacheInvalidation';

export class ScheduleLotteryController {
  private repository = new ScheduleLotteryRepository();

  async getAllScheduleLotteries(organization_id: string): Promise<IScheduleLotteryEntityFront> {
    const key = getScheduleLotteryCacheKey(organization_id);
    const snap = await globalCacheManager.getOrLoad(key, async () => {
      const response = await this.repository.getAllScheduleLottery(organization_id);
      return parseScheduleLottery(response);
    });
    return snap.payload;
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
      invalidateScheduleLotteryRelated(organization_id);
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
      console.error('bulkActiveLotteries:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async saveScheduleLottery(
    scheduleLottery: IScheduleLotteryEntityFront,
    organization_id: string
  ): Promise<IScheduleLotteryEntityFront> {
    try {
      await this.repository.saveScheduleLottery(scheduleLottery, organization_id);

      const lotteries: string[] = [];
      for (const daySchedules of Object.values(scheduleLottery)) {
        for (const lotteryIds of Object.values(daySchedules ?? {})) {
          for (const id of lotteryIds) {
            if (!lotteries.includes(id)) lotteries.push(id);
          }
        }
      }

      if (lotteries.length > 0) {
        await this.repository.bulkActiveLotteries(lotteries, organization_id);
      }

      invalidateScheduleLotteryRelated(organization_id);
      return await this.getAllScheduleLotteries(organization_id);
    } catch (error) {
      console.error('saveScheduleLottery:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async getScheduleLotteriesForDay(
    organization_id: string,
    day: SCHEDULE_DAY
  ): Promise<IScheduleLotteryEntityBack[]> {
    try {
      return await this.repository.getScheduleLotteriesByDay(organization_id, day);
    } catch (error) {
      console.error('getScheduleLotteriesForDay:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async getLotteryIdsForDay(organization_id: string, day: SCHEDULE_DAY): Promise<string[]> {
    try {
      const records = await this.repository.getScheduleLotteriesByDay(organization_id, day);
      return [...new Set(records.map((record) => record.lottery_id))];
    } catch (error) {
      console.error('getLotteryIdsForDay:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async getScheduleIdsForDay(organization_id: string, day: SCHEDULE_DAY): Promise<string[]> {
    try {
      const records = await this.repository.getScheduleLotteriesByDay(organization_id, day);
      return [...new Set(records.map((record) => record.schedule_id))];
    } catch (error) {
      console.error('getScheduleIdsForDay:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async getLotteryIdsByScheduleAndDay(
    organization_id: string,
    schedule_id: string,
    day: SCHEDULE_DAY
  ): Promise<string[]> {
    try {
      const records = await this.repository.getScheduleLotteriesByScheduleAndDay(
        organization_id,
        schedule_id,
        day
      );
      return records.map((record) => record.lottery_id);
    } catch (error) {
      console.error('getLotteryIdsByScheduleAndDay:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }
}
