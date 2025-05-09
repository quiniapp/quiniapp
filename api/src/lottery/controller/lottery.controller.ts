import { Request, Response } from 'express';
import { LotteryRepository } from '../repository/lottery.repository';
import { INewLotteryEntity } from '@helper/request/lottery.response';
import { lotteryBase } from '../helper/lotteryBase';
import { parseLottery } from '../helper/parseLottery';

export class LotteryController {
  private repository = new LotteryRepository();

  get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.repository.getById(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving Lottery', details: error });
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const result = await this.repository.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving Lotterys', details: error });
    }
  };

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

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const result = await this.repository.update(id, body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error updating Lottery', details: error });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.repository.delete(id);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting Lottery', details: error });
    }
  };
}
