import { ILotteryEntityBack, ILotteryEntityFront } from './lottery.type';
import { IScheduleEntityBack, IScheduleEntityFront } from './schedule.type';
export interface IResultsBase {
  results_id: string;
  organization_id: string;
  date: string;
  results: string[];
  lottery_id: string;
  schedule_id: string;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}
export interface IResultsEntityBack extends IResultsBase {
  lottery: ILotteryEntityBack;
  schedule: IScheduleEntityBack;
}
export type IResultsEntityFront = Omit<
  IResultsBase,
  'deleted_at' | 'edited_at' | 'created_at' | 'lottery_id' | 'schedule_id' | 'organization_id'
> & {
  lottery: ILotteryEntityFront;
  schedule: IScheduleEntityFront;
};
