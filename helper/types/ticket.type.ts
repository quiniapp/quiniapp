export interface ITicketEntityBack {
  ticket_id: string;
  user_id: string | null;
  user_name: string;
  ticket_number: number;
  date: string;
  paid: boolean;
  winner: boolean;
  total: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export type IBetEntityFront = Omit<ITicketEntityBack, 'created_at' | 'deleted_at'>;
