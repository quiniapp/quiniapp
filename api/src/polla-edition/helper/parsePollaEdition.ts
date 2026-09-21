import {
  IPollaEditionEntityBack,
  IPollaEditionEntityFront,
} from '@helper/types/polla-edition.type';

export const parsePollaEdition = (edition: IPollaEditionEntityBack): IPollaEditionEntityFront => {
  return {
    polla_edition_id: edition.polla_edition_id,
    lottery_id: edition.lottery_id,
    schedule_id: edition.schedule_id,
    start_date: edition.start_date,
    end_date: edition.end_date,
    load_limit_date: edition.load_limit_date,
    pool_amount: edition.pool_amount,
    ticket_price: edition.ticket_price,
    status: edition.status,
    winner_date: edition.winner_date,
  };
};
