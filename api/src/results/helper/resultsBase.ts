import { INewResultsEntity } from '@helper/request/results.request';
import { IResultsBase } from '@helper/types/results.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const resultsBase = (results: INewResultsEntity, organization_id: string): IResultsBase => {
  const timestamp = dayjs().toISOString();
  return {
    results_id: uuidv4(),
    organization_id,
    results: results.results,
    date: results?.date ?? dayjs().format('YYYY-MM-DD'),
    schedule_id: results.schedule_id,
    lottery_id: results.lottery_id,
    created_at: timestamp,
    edited_at: timestamp,
    deleted_at: null,
  };
};
