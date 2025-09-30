import { IBetEntityBase } from 'types/bet.type';
import { ITicketEntityBack, ITicketEntityBase } from '../types/ticket.type';
import { IUserEntityBack } from '../types/user.type';
import { INewBetEntity } from './bet.response';

export type INewTicketEntity = Pick<ITicketEntityBack, 'user_id' | 'user_name' | 'date'> & {
  bets: INewBetEntity[];
};
export type IEditTicketEntity = Pick<ITicketEntityBack, 'ticket_id'> & {
  bets: INewBetEntity[];
};
export interface INewTicketBaseEntity extends ITicketEntityBase {
  bets: IBetEntityBase[];
}
export type IDeleteTicketEntity = Pick<ITicketEntityBack, 'ticket_number'> &
  Partial<Pick<IUserEntityBack, 'user_type' | 'user_id'>>;

export type IGetTicketEntity = Partial<Pick<ITicketEntityBack, 'ticket_id' | 'ticket_number'>>;

export type IGetAllTicketEntity = Pick<IUserEntityBack, 'user_id' | 'user_type'> &
  Partial<Pick<ITicketEntityBack, 'date' | 'winner'>> & { cashier_id?: string };

export type IGetAllTicketByUserEntity = Pick<ITicketEntityBack, 'date' | 'user_id'> &
  Partial<Pick<ITicketEntityBack, 'winner'>>;
