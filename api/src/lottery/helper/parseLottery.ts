import { ILotteryEntityBack, ILotteryEntityFront } from '@helper/types/lottery.type';

export const parseLottery = (lottery: ILotteryEntityBack): ILotteryEntityFront => {
  return {
    active: lottery.active,
    lottery_id: lottery.lottery_id,
    name: lottery.name,
  };
};
