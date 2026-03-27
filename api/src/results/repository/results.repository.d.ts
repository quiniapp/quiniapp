import { IGetResultsEntity } from '@helper/request/results.request';
import { IResultsBase } from '@helper/types/results.type';
export declare class ResultsRepository {
  private baseQuery;
  create(
    payload: Omit<IResultsBase, 'results_id' | 'created_at' | 'edited_at' | 'deleted_at'>
  ): Promise<any>;
  getById(id: string, organization_id: string): Promise<any>;
  get(
    props: IGetResultsEntity & {
      organization_id: string;
    }
  ): Promise<any[]>;
  getAll(organization_id: string): Promise<any[]>;
  update(id: string, payload: Partial<IResultsBase>, organization_id: string): Promise<any>;
  delete(id: string, organization_id: string): Promise<any>;
}
