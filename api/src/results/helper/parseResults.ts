import { IResultsEntityBack, IResultsEntityFront } from 'helper/types/results.type';
import { parseLottery } from 'api/src/lottery/helper/parseLottery';
import { parseSchedule } from 'api/src/shcedule/helper/parseSchedule';

export const parseResults = (results: IResultsEntityBack): IResultsEntityFront => {
  return {
    results_id: results.results_id,
    results: results.results,
    date: results.date,
    lottery: parseLottery(results?.lottery),
    schedule: parseSchedule(results?.schedule),
  };
};
