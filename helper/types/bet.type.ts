export interface IBetEntityBack {
  bet_id: string;
  ticket_id: string;
  cashier_id: string;
  date: string;
  number: number | number[];
  amount: number;
  place: number;
  with: number;
  position: number;
  winner: boolean;
  created_at: string;
  deleted_at: string;
}
