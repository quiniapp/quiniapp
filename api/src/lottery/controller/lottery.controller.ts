import { LotteryRepository } from '../repository/lottery.repository';
import {
  IDeleteLotteryEntity,
  IGetLotteryEntity,
  INewLotteryEntity,
  IUpdateLotteryEntity,
} from '@helper/request/lottery.response';
import { lotteryBase } from '../helper/lotteryBase';
import { parseLottery } from '../helper/parseLottery';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

export class LotteryController {
  private repository = new LotteryRepository();

  create = async (props: INewLotteryEntity) => {
    const newLottery = lotteryBase(props);
    try {
      const result = await this.repository.create(newLottery);
      return parseLottery(result);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  get = async (props: IGetLotteryEntity): Promise<ILotteryEntityFront> => {
    try {
      const lottery = await this.repository.getById(props.lottery_id);
      return parseLottery(lottery);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (): Promise<ILotteryEntityFront[]> => {
    try {
      const lotterys = await this.repository.getAll();

      return lotterys.map((lottery) => {
        return parseLottery(lottery);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (id: string, props: IUpdateLotteryEntity): Promise<ILotteryEntityFront> => {
    try {
      const lottery = await this.repository.update(id, props);
      return parseLottery(lottery);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  delete = async (props: IDeleteLotteryEntity) => {
    try {
      await this.repository.delete(props.lottery_id);
      return;
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
