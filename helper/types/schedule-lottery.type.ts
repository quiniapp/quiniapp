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
  id: string;
  day: SCHEDULE_DAY;
  lottery_id: string;
  schedule_id: string;
  created_at: string;
}

// Solo las claves STRING del enum (evita 0|1|2...)
export type EnumStringKeys<E> = Extract<keyof E, string>;
export type DayKey = EnumStringKeys<typeof SCHEDULE_DAY>;

export type IScheduleLotteryEntityFront = Partial<Record<DayKey, Record<string, string[]>>>;
