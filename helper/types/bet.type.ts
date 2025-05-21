export enum BET_TYPE {
  ONE = 'ONE',
  DOUBLE = 'DOUBLE',
  TERN = 'TERN',
  QUATERN = 'QUATERN',
  BORRATINA = 'BORRATINA',
  REDOUBLE = 'REDOUBLE',
}

export enum PLACE_TYPE {
  HEAD = 'HEAD',
  FIVE = 'FIVE',
  TEN = 'TEN',
  TWENTY = 'TWENTY',
}

export interface IBetEntityBack {
  bet_id: string;
  bet_type: BET_TYPE;
  ticket_id: string;
  user_id: string;
  number: string;
  amount: number;
  place: PLACE_TYPE;
  with: string | null;
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
