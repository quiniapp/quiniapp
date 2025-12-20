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

export class LotteryController {
  private repository = new LotteryRepository();
  private scheduleLotteryController = new ScheduleLotteryController();

  create = async (props: INewLotteryEntity, organization_id: string) => {
    try {
      // If order is not provided, get the next available order
      const order = props.order ?? (await this.repository.getNextOrder(organization_id));
      const newLottery = lotteryBase({ ...props, order }, organization_id);
      const result = await this.repository.create(newLottery);
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
      const lotterys = await this.repository.getAll(organization_id!, all);

      return lotterys.map((lottery) => {
        return parseLottery(lottery);
      });
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
      // Get lottery IDs that are configured for this day
      const lotteryIds = await this.scheduleLotteryController.getLotteryIdsForDay(
        organization_id,
        day
      );

      // Get all lotteries
      const allLotteries = await this.repository.getAll(organization_id, all);

      // Filter lotteries by IDs that are configured for this day
      const filteredLotteries = allLotteries.filter((lottery) =>
        lotteryIds.includes(lottery.lottery_id)
      );

      return filteredLotteries.map((lottery) => parseLottery(lottery));
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
      return parseLottery(lottery);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  delete = async (props: IDeleteLotteryEntity, organization_id: string) => {
    try {
      await this.repository.delete(props.lottery_id, organization_id);
      return;
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
