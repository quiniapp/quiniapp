import { IBetEntityBase, IBetEntityFront } from './bet.type';

export interface ITicketEntityBase {
  ticket_id: string;
  user_id: string | null;
  user_name: string;
  ticket_number: number;
  date: string;
  paid: boolean;
  winner: boolean;
  total: number;
  total_prize: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface ITicketEntityBack extends ITicketEntityBase {
  bets: IBetEntityBase[];
}

export type ITicketEntityFront = Omit<
  ITicketEntityBase,
  'created_at' | 'deleted_at' | 'edited_at'
> & {
  bets: IBetEntityFront[];
};
