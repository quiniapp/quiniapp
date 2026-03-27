import { INewResultsEntity } from '@helper/request/results.request';
import { IResultsBase } from '@helper/types/results.type';
export declare const resultsBase: (
  results: INewResultsEntity,
  organization_id: string
) => IResultsBase;
