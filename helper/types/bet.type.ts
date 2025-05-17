export enum BET_TYPE {
  ONE = 'ONE',
  DOUBLE = 'DOUBLE',
  TERN = 'TERN',
  QUATERN = 'QUATERN',
  BORRATINA = 'BORRATINA',
  REDOUBLE = 'REDOUBLE',
}

export enum PLACE_TYPE {
  HEAD = 1,
  FIVE = 5,
  TEN = 10,
  TWENTY = 20,
}

export interface IBetEntityBack {
  bet_id: string;
  bet_type: BET_TYPE;
  ticket_id: string;
  user_id: string;
  number: number;
  amount: number;
  place: PLACE_TYPE;
  with: number | null;
  position: PLACE_TYPE | null;
  date: string;
  winner: boolean;
  paid: boolean;
  lottery_id: string;
  schedule_id: string;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IBetEntityFront = Omit<IBetEntityBack, 'created_at' | 'edited_at' | 'deleted_at'>;
