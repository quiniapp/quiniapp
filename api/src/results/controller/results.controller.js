import { parseResults } from '../helper/parseResults';
import { ResultsRepository } from '../repository/results.repository';
import { resultsBase } from '../helper/resultsBase';
export class ResultsController {
    constructor() {
        this.repository = new ResultsRepository();
        this.create = async (props, organization_id) => {
            try {
                const newResults = resultsBase(props, organization_id);
                const results = await this.repository.create(newResults);
                return parseResults(results);
            }
            catch (error) {
                console.error('Creation error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.get = async (props, organization_id) => {
            let results;
            try {
                if (props?.results_id) {
                    results = await this.repository.getById(props.results_id, organization_id);
                }
                else
                    results = await this.repository.get({ ...props, organization_id });
                if (!results.length)
                    return [];
                return parseResults(results[0]);
            }
            catch (error) {
                console.error('Get error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAll = async (organization_id) => {
            try {
                const resultss = await this.repository.getAll(organization_id);
                return resultss.map((results) => {
                    return parseResults(results);
                });
            }
            catch (error) {
                console.error('GetAll error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.update = async (id, props, organization_id) => {
            try {
                const results = await this.repository.update(id, props, organization_id);
                return parseResults(results);
            }
            catch (error) {
                console.error('Update error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.delete = async (id, organization_id) => {
            try {
                const results = await this.repository.delete(id, organization_id);
                return parseResults(results);
            }
            catch (error) {
                console.error('Update error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
