import { IUserEntityBack } from '@helper/types/user.type';
import { ITicketEntityBack } from '../types/ticket.type';
import { INewBetEntity } from './bet.response';

export type INewTicketEntity = Pick<ITicketEntityBack, 'user_id' | 'user_name' | 'date'> & {
  bets: INewBetEntity[];
};

export type IDeleteTicketEntity = Pick<ITicketEntityBack, 'ticket_id'> &
  Partial<Pick<IUserEntityBack, 'user_type' | 'user_id'>>;

export type IGetTicketEntity = Partial<Pick<ITicketEntityBack, 'ticket_id' | 'ticket_number'>>;

export type IGetAllTicketEntity = Pick<IUserEntityBack, 'user_id' | 'user_type'>;
