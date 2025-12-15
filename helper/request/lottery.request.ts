import { ILotteryEntityBack } from '../types/lottery.type';

export type INewLotteryEntity = Pick<ILotteryEntityBack, 'name'> & {
  order?: number;
};

export type IUpdateLotteryEntity = Partial<Pick<ILotteryEntityBack, 'name' | 'active' | 'order'>>;

export type IDeleteLotteryEntity = Pick<ILotteryEntityBack, 'lottery_id'>;

export type IGetLotteryEntity = Pick<ILotteryEntityBack, 'lottery_id'>;
