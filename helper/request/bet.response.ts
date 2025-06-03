import { IBetEntityBack } from '@helper/types/bet.type';

export type INewBetEntity = Omit<
  IBetEntityBack,
  'bet_id' | 'ticket_id' | 'created_at' | 'edited_at' | 'deleted_at' | 'paid' | 'winner'
>;

export type IDeleteBetEntity = Pick<IBetEntityBack, 'bet_id'>;

export type IGetBetEntity = Pick<IBetEntityBack, 'bet_id'>;
