import { IBetTable } from '../request/ticket.request';

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
  client_request_id?: string | null; // idempotency key
}

export interface ITicketEntityBack extends ITicketEntityBase {
  bets: IBetTable[];
}
export type ITicketEntityFront = Omit<
  ITicketEntityBase,
  'created_at' | 'deleted_at' | 'edited_at' | 'organization_id'
> & {
  bets: IBetTable[];
};
