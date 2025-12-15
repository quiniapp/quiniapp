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
  organization_id: string;
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
  hits: number;
  ticket_number: string;
  cashier_name: string;
  deleted_at: string | null;
  bet_order: number;
}

export type IBetEntityBack = Omit<IBetEntityBase, 'bet_order'> & {
  lotteries: ILotteryEntityBack;
  schedules: IScheduleEntityBack;
};

export type IBetEntityFront = Omit<
  IBetEntityBase,
  'created_at' | 'edited_at' | 'deleted_at' | 'bet_order'
> & {
  lottery: ILotteryEntityFront;
  schedule: IScheduleEntityFront;
};
