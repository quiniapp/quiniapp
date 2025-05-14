import { ILotteryEntityBack } from '@helper/types/lottery.type';

export type INewLotteryEntity = Pick<ILotteryEntityBack, 'name'>;

export type IUpdateLotteryEntity = Pick<ILotteryEntityBack, 'name' | 'active'>;

export type IDeleteLotteryEntity = Pick<ILotteryEntityBack, 'lottery_id'>;

export type IGetLotteryEntity = Pick<ILotteryEntityBack, 'lottery_id'>;
