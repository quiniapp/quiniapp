import { IBetEntityBack, IBetEntityBase } from '../types/bet.type';

export type INewBetEntity = Omit<
  IBetEntityBack,
  'bet_id' | 'ticket_id' | 'created_at' | 'edited_at' | 'deleted_at' | 'paid' | 'winner' | 'prize'
>;

export type IDeleteBetEntity = Pick<IBetEntityBase, 'bet_id'>;

export type IGetBetEntity = Pick<IBetEntityBase, 'bet_id'>;
