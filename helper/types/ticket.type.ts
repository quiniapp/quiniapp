import { IBetTable } from '../request/ticket.response';

export interface ITicketEntityBase {
  ticket_id: string;
  organization_id: string;
  user_id: string | null;
  user_name: string;
  ticket_number: string;
  date: string;
  paid: boolean;
  winner: boolean;
  total: number;
  total_prize: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  hits: number;
}

export interface ITicketEntityBack extends ITicketEntityBase {
  bets: IBetTable[];
}
export type ITicketEntityFront = Omit<
  ITicketEntityBase,
  'created_at' | 'deleted_at' | 'edited_at'
> & {
  bets: IBetTable[];
};
