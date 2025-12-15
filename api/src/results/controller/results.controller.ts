import { parseResults } from '../helper/parseResults';
import { ResultsRepository } from '../repository/results.repository';
import { IResultsEntityBack, IResultsEntityFront } from '@helper/types/results.type';
import {
  IGetResultsEntity,
  INewResultsEntity,
  IUpdateResultsEntity,
} from '@helper/request/results.request';
import { resultsBase } from '../helper/resultsBase';

export class ResultsController {
  private repository = new ResultsRepository();

  create = async (props: INewResultsEntity): Promise<IResultsEntityFront> => {
    try {
      const newResults = resultsBase(props);
      const results = await this.repository.create(newResults, props.organization_id);

      return parseResults(results);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  get = async (props: IGetResultsEntity): Promise<IResultsEntityFront | []> => {
    let results;
    try {
      if (props?.results_id) {
        results = await this.repository.getById(props.results_id, props.organization_id!);
      } else results = await this.repository.get(props, props.organization_id!);
      if (!results.length) return [];
      return parseResults(results[0]);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  getAll = async (organization_id: string): Promise<IResultsEntityFront[]> => {
    try {
      const resultss: IResultsEntityBack[] = await this.repository.getAll(organization_id);

      return resultss.map((results) => {
        return parseResults(results);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (id: string, props: IUpdateResultsEntity): Promise<IResultsEntityFront> => {
    try {
      const results = await this.repository.update(id, props, props.organization_id!);
      return parseResults(results);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (id: string, organization_id: string): Promise<IResultsEntityFront> => {
    try {
      const results = await this.repository.delete(id, organization_id);

      return parseResults(results);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
