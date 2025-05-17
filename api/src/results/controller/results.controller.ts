import { parseResults } from '../helper/parseResults';
import { USER_TYPE } from '@helper/types/user.type';
import { ResultsRepository } from '../repository/results.repository';
import { IResultsEntityBack, IResultsEntityFront } from '@helper/types/results.type';
import {
  IGetResultsEntity,
  INewResultsEntity,
  IUpdateResultsEntity,
} from '@helper/request/results.response';
import { resultsBase } from '../helper/resultsBase';

export class ResultsController {
  private repository = new ResultsRepository();

  create = async (props: INewResultsEntity): Promise<IResultsEntityFront> => {
    try {
      const newResults = resultsBase(props);
      const results = await this.repository.create(newResults);
      console.log(results);
      return parseResults(results);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getById = async (props: IGetResultsEntity): Promise<IResultsEntityFront> => {
    try {
      const results = await this.repository.getById(props.results_id);
      return parseResults(results);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  get = async (props: IGetResultsEntity): Promise<IResultsEntityFront> => {
    try {
      const results = await this.repository.getById(props.results_id);
      return parseResults(results);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  getAll = async (user_type: USER_TYPE): Promise<IResultsEntityFront[]> => {
    try {
      const resultss: IResultsEntityBack[] = await this.repository.getAll(user_type);

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
      const results = await this.repository.update(id, props);
      return parseResults(results);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
