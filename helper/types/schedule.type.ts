import { IScheduleLotteryEntityBack } from './schedule-lottery.type';

export interface IScheduleEntityBack {
  schedule_id: string;
  organization_id: string;
  name: string;
  time: string;
  active: boolean;
  created_at: string;
  edited_at: string;
  schedule_lotteries?: IScheduleLotteryEntityBack[];
}

export type IScheduleEntityFront = Omit<
  IScheduleEntityBack,
  'created_at' | 'edited_at' | 'organization_id' | 'active'
>;
