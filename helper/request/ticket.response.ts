import { IScheduleEntityFront } from 'types/schedule.type';
import { IBetEntityBase, PLACE_TYPE } from '../types/bet.type';
import { ITicketEntityBase } from '../types/ticket.type';
import { IUserEntityBack } from '../types/user.type';
import { INewBetEntity } from './bet.response';
import { ILotteryEntityFront } from 'types/lottery.type';

export type INewTicketEntity = Pick<ITicketEntityBase, 'user_id' | 'user_name' | 'date'> & {
  bets: INewBetEntity[];
};
export type IEditTicketEntity = Pick<ITicketEntityBase, 'ticket_id'> & {
  bets: INewBetEntity[];
};
export interface INewTicketBaseEntity extends ITicketEntityBase {
  bets: IBetEntityBase[];
}
export type IDeleteTicketEntity = Pick<ITicketEntityBase, 'ticket_number'> &
  Partial<Pick<IUserEntityBack, 'user_type' | 'user_id'>>;

export type IGetTicketEntity = Partial<Pick<ITicketEntityBase, 'ticket_id' | 'ticket_number'>>;

export type IGetAllTicketEntity = Pick<IUserEntityBack, 'user_id' | 'user_type'> &
  Partial<Pick<ITicketEntityBase, 'date' | 'winner'>> & { cashier_id?: string };

export type IGetAllTicketByUserEntity = Pick<ITicketEntityBase, 'date' | 'user_id'> &
  Partial<Pick<ITicketEntityBase, 'winner'>>;

export interface ILotterySchedule {
  schedule: IScheduleEntityFront;
  lotteries: ILotteryEntityFront[];
}
export interface IBetTable {
  number: string;
  amount: number;
  place: PLACE_TYPE;
  with: string | null;
  position?: PLACE_TYPE | null;
  scheduleLottery: ILotterySchedule[];
}
