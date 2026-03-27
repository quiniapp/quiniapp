export declare enum SCHEDULE_DAY {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}
export interface IScheduleLotteryEntityBack {
  id: string;
  organization_id: string;
  day: SCHEDULE_DAY;
  lottery_id: string;
  schedule_id: string;
  created_at: string;
}
export type EnumStringKeys<E> = Extract<keyof E, string>;
export type DayKey = EnumStringKeys<typeof SCHEDULE_DAY>;
export type IScheduleLotteryEntityFront = Partial<Record<DayKey, Record<string, string[]>>>;
export interface IScheduleLotteryDeletion {
  day: DayKey;
  scheduleId: string;
}
export interface IScheduleLotteryPartialUpdate {
  changes: Partial<Record<DayKey, Record<string, string[]>>>;
  deletions?: IScheduleLotteryDeletion[];
}
export interface IScheduleLotteryUpdate {
  full?: IScheduleLotteryEntityFront;
  partial?: IScheduleLotteryPartialUpdate;
}
