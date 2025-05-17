import { IResultsEntityBack } from '@helper/types/results.type';

export type INewResultsEntity = Pick<IResultsEntityBack, 'results' | 'lottery_id' | 'schedule_id'> &
  Partial<Pick<IResultsEntityBack, 'date'>> &
  Omit<IResultsEntityBack, 'lottery' | 'schedule'>;

export type IUpdateResultsEntity = Partial<
  Pick<IResultsEntityBack, 'date' | 'results' | 'lottery_id' | 'schedule_id'>
>;

export type IDeleteResultsEntity = Pick<IResultsEntityBack, 'results_id'>;

export type IGetResultsEntity = Pick<
  IResultsEntityBack,
  'results_id' | 'date' | 'lottery_id' | 'schedule_id'
>;
