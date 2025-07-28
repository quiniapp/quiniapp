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
  schedule_lottery_id: number;
  day: SCHEDULE_DAY;
  lottery_id: string;
  schedule_id: string;
  created_at: string;
}

export type IScheduleLotteryEntityFront = {
  [day in keyof typeof SCHEDULE_DAY]?: {
    [schedule_id: string]: string[];
  };
};
