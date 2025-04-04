export interface ITicketEntityBack {
  ticket_id: string;
  cashier_id: string;
  lottery_id: string;
  schedule_id: string;
  ticket_number: number;
  date: string;
  paid: boolean;
  winner: boolean;
}
