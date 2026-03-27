import { IResultsEntityFront } from '@helper/types/results.type';
import {
  IGetResultsEntity,
  INewResultsEntity,
  IUpdateResultsEntity,
} from '@helper/request/results.request';
export declare class ResultsController {
  private repository;
  create: (props: INewResultsEntity, organization_id: string) => Promise<IResultsEntityFront>;
  get: (props: IGetResultsEntity, organization_id: string) => Promise<IResultsEntityFront | []>;
  getAll: (organization_id: string) => Promise<IResultsEntityFront[]>;
  update: (
    id: string,
    props: IUpdateResultsEntity,
    organization_id: string
  ) => Promise<IResultsEntityFront>;
  delete: (id: string, organization_id: string) => Promise<IResultsEntityFront>;
}
