import { ILotteryEntityBack, ILotteryEntityFront } from './lottery.type';
import { IScheduleEntityBack, IScheduleEntityFront } from './schedule.type';

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

export interface IBetEntityBase {
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
  prize: number;
  deleted_at: string | null;
}

export interface IBetEntityBack extends IBetEntityBase {
  lottery: ILotteryEntityBack;
  schedule: IScheduleEntityBack;
}

export type IBetEntityFront = Omit<IBetEntityBase, 'created_at' | 'edited_at' | 'deleted_at'> & {
  lottery: ILotteryEntityFront;
  schedule: IScheduleEntityFront;
};
