import { IBetEntityBack, IBetEntityBase } from '../types/bet.type';

export type INewBetEntity = Omit<
  IBetEntityBase,
  | 'bet_id'
  | 'ticket_id'
  | 'created_at'
  | 'edited_at'
  | 'deleted_at'
  | 'paid'
  | 'winner'
  | 'prize'
  | 'ticket_number'
  | 'hits'
>;

export type IDeleteBetEntity = Pick<IBetEntityBase, 'bet_id'>;

export type IGetBetEntity = Pick<IBetEntityBase, 'bet_id'>;
