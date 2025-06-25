import { ILotteryEntityBack } from './lottery.type';

export enum SCHEDULE_DAY {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export interface IScheduleLotteryEntityBack {
  day: SCHEDULE_DAY;
  lotteries: ILotteryEntityBack[];
}
