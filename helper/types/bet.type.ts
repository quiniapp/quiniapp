export enum LOTTERY_TYPE {
  NORMAL,
  BORRATINA,
}
export interface IBetEntityBack {
  bet_id: string;
  ticket_id: string;
  cashier_id: string | null;
  user_id: string | null;
  date: string;
  number: number | number[];
  amount: number;
  place: number;
  with: number;
  position: number;
  winner: boolean;
  lottery_type: LOTTERY_TYPE;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type IBetEntityFront = Omit<IBetEntityBack, 'created_at' | 'updated_at' | 'deleted_at'>;
