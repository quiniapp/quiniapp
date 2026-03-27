import { INewLotteryEntity } from '@helper/request/lottery.request';
import { ILotteryEntityBack } from '@helper/types/lottery.type';
export declare const lotteryBase: (
  lottery: INewLotteryEntity,
  organization_id: string
) => ILotteryEntityBack;
