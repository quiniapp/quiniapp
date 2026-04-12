import { LotteryRepository } from '../repository/lottery.repository';
import {
  IDeleteLotteryEntity,
  IGetLotteryEntity,
  INewLotteryEntity,
  IUpdateLotteryEntity,
} from '@helper/request/lottery.request';
import { lotteryBase } from '../helper/lotteryBase';
import { parseLottery } from '../helper/parseLottery';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
import { ScheduleLotteryController } from '../../schedule-lottery/controller/schedule-lottery.controller';
import { globalCacheManager } from 'src/cache/CacheManager';
import {
  getLotteryCacheKey,
  getLotteryDayCacheKey,
  invalidateLotteryRelated,
} from 'src/cache/cacheInvalidation';

export class LotteryController {
  private repository = new LotteryRepository();
  private scheduleLotteryController = new ScheduleLotteryController();

  create = async (props: INewLotteryEntity, organization_id: string) => {
    try {
      const order = props.order ?? (await this.repository.getNextOrder(organization_id));
      const newLottery = lotteryBase({ ...props, order }, organization_id);
      const result = await this.repository.create(newLottery);
      invalidateLotteryRelated(organization_id);
      return parseLottery(result);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  get = async (props: IGetLotteryEntity, organization_id: string): Promise<ILotteryEntityFront> => {
    try {
      const lottery = await this.repository.getById(props.lottery_id, organization_id);
      return parseLottery(lottery);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (all?: boolean, organization_id?: string): Promise<ILotteryEntityFront[]> => {
    try {
      const key = getLotteryCacheKey(organization_id!, all ?? false);
      const snap = await globalCacheManager.getOrLoad(key, async () => {
        const lotterys = await this.repository.getAll(organization_id!, all);
        return lotterys.map(parseLottery);
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
    organization_id: string
  ): Promise<ILotteryEntityFront[]> => {
    try {
      const key = getLotteryDayCacheKey(organization_id, day, all);
      const snap = await globalCacheManager.getOrLoad(key, async () => {
        const lotteryIds = await this.scheduleLotteryController.getLotteryIdsForDay(
          organization_id,
          day
        );
        const allLotteries = await this.repository.getAll(organization_id, all);
        return allLotteries
          .filter((lottery) => lotteryIds.includes(lottery.lottery_id))
          .map(parseLottery);
      });
      return snap.payload;
    } catch (error) {
      console.error('getAllByDay error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (
    id: string,
    props: IUpdateLotteryEntity,
    organization_id: string
  ): Promise<ILotteryEntityFront> => {
    try {
      const lottery = await this.repository.update(id, props, organization_id);
      invalidateLotteryRelated(organization_id);
      return parseLottery(lottery);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (props: IDeleteLotteryEntity, organization_id: string) => {
    try {
      await this.repository.delete(props.lottery_id, organization_id);
      invalidateLotteryRelated(organization_id);
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
