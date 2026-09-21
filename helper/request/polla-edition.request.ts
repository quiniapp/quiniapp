import { IPollaEditionEntityBack } from '../types/polla-edition.type';

export type INewPollaEditionEntity = Pick<
  IPollaEditionEntityBack,
  | 'lottery_id'
  | 'schedule_id'
  | 'start_date'
  | 'end_date'
  | 'load_limit_date'
  | 'pool_amount'
  | 'ticket_price'
>;

export type IUpdatePollaEditionEntity = Partial<INewPollaEditionEntity>;

export type IDeletePollaEditionEntity = Pick<IPollaEditionEntityBack, 'polla_edition_id'>;

export type IGetPollaEditionEntity = Pick<IPollaEditionEntityBack, 'polla_edition_id'>;
