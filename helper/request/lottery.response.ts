import { ILotteryEntityBack } from '../types/lottery.type';

export type INewLotteryEntity = Pick<ILotteryEntityBack, 'name' | 'organization_id'>;

export type IUpdateLotteryEntity = Partial<
  Pick<ILotteryEntityBack, 'name' | 'active' | 'organization_id'>
>;

export type IDeleteLotteryEntity = Pick<ILotteryEntityBack, 'lottery_id' | 'organization_id'>;

export type IGetLotteryEntity = Pick<ILotteryEntityBack, 'lottery_id' | 'organization_id'>;
