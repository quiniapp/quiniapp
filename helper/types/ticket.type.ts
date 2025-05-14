export interface ITicketEntityBack {
  ticket_id: string;
  user_id: string | null;
  ticket_number: number;
  date: string;
  paid: boolean;
  winner: boolean;
  created_at: string;
  deleted_at: string | null;
}

export type IBetEntityFront = Omit<ITicketEntityBack, 'created_at' | 'deleted_at'>;
