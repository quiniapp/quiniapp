import { ScheduleRepository } from '../repository/schedule.repository';
import { IScheduleEntityBack, IScheduleEntityFront } from '@helper/types/schedule.type';
import {
  IDeleteScheduleEntity,
  IGetScheduleEntity,
  INewScheduleEntity,
  IUpdateScheduleEntity,
} from '@helper/request/schedule.request';
import { scheduleBase } from '../helper/scheduleBase';
import { parseSchedule } from '../helper/parseSchedule';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
import { ScheduleLotteryController } from '../../schedule-lottery/controller/schedule-lottery.controller';
import { globalCacheManager } from 'src/cache/CacheManager';
import {
  getScheduleCacheKey,
  getScheduleDayCacheKey,
  invalidateScheduleRelated,
} from 'src/cache/cacheInvalidation';

export class ScheduleController {
  private repository = new ScheduleRepository();
  private scheduleLotteryController = new ScheduleLotteryController();

  create = async (
    props: INewScheduleEntity,
    organization_id: string
  ): Promise<IScheduleEntityFront> => {
    try {
      const newSchedule = scheduleBase(props, organization_id);
      const schedule = await this.repository.create(newSchedule);
      invalidateScheduleRelated(organization_id);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Controller creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  get = async (
    props: IGetScheduleEntity,
    organization_id: string
  ): Promise<IScheduleEntityFront> => {
    try {
      const schedule = await this.repository.getById(props.schedule_id, organization_id);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (organization_id: string, all?: boolean): Promise<IScheduleEntityFront[]> => {
    try {
      const key = getScheduleCacheKey(organization_id, all ?? false);
      const snap = await globalCacheManager.getOrLoad(key, async () => {
        const schedules: IScheduleEntityBack[] = await this.repository.getAll(organization_id, all);
        return schedules.map(parseSchedule);
      });
      return snap.payload;
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAllByDay = async (
    day: SCHEDULE_DAY,
    all: boolean,
    organization_id: string,
    withLotteries: boolean = false
  ): Promise<IScheduleEntityFront[]> => {
    try {
      const key = getScheduleDayCacheKey(organization_id, day, all, withLotteries);
      const snap = await globalCacheManager.getOrLoad(key, async () => {
        const [slRecords, allSchedules] = await Promise.all([
          this.scheduleLotteryController.getScheduleLotteriesForDay(organization_id, day),
          this.repository.getAll(organization_id, all),
        ]);

        const scheduleIdSet = new Set(slRecords.map((r) => r.schedule_id));
        const lotteryIdsBySchedule = new Map<string, string[]>();
        for (const r of slRecords) {
          const ids = lotteryIdsBySchedule.get(r.schedule_id) ?? [];
          ids.push(r.lottery_id);
          lotteryIdsBySchedule.set(r.schedule_id, ids);
        }

        const parsedSchedules = allSchedules
          .filter((s) => scheduleIdSet.has(s.schedule_id))
          .map((s) => parseSchedule(s));

        if (withLotteries) {
          return parsedSchedules.map((schedule) => ({
            ...schedule,
            lottery_ids: lotteryIdsBySchedule.get(schedule.schedule_id) ?? [],
          }));
        }

        return parsedSchedules;
      });
      return snap.payload;
    } catch (error) {
      console.error('getAllByDay error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (
    id: string,
    props: IUpdateScheduleEntity,
    organization_id: string
  ): Promise<IScheduleEntityFront> => {
    try {
      const schedule = await this.repository.update(id, props, organization_id);
      invalidateScheduleRelated(organization_id);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (props: IDeleteScheduleEntity, organization_id: string) => {
    try {
      await this.repository.delete(props.schedule_id, organization_id);
      invalidateScheduleRelated(organization_id);
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
