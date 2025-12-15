import { IResultsEntityBack } from '../types/results.type';

export type INewResultsEntity = Pick<
  IResultsEntityBack,
  'results' | 'lottery_id' | 'schedule_id' | 'organization_id'
> &
  Partial<Pick<IResultsEntityBack, 'date'>>;

export type IUpdateResultsEntity = Partial<
  Pick<IResultsEntityBack, 'date' | 'results' | 'lottery_id' | 'schedule_id' | 'organization_id'>
>;

export type IDeleteResultsEntity = Pick<
  IResultsEntityBack,
  'results_id' | 'schedule_id' | 'lottery_id' | 'date' | 'organization_id'
>;

export type IGetResultsEntity = Partial<
  Pick<IResultsEntityBack, 'results_id' | 'date' | 'lottery_id' | 'schedule_id' | 'organization_id'>
>;
