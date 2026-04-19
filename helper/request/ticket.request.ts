import { IScheduleEntityFront } from '../types/schedule.type';
import { PLACE_TYPE } from '../types/bet.type';
import { ITicketEntityBase } from '../types/ticket.type';
import { IUserEntityBack } from '../types/user.type';
import { ILotteryEntityFront } from '../types/lottery.type';

export type INewTicketEntity = Pick<ITicketEntityBase, 'user_id' | 'user_name' | 'date'> & {
  bets: IBetTable[];
  client_request_id?: string;
  user_number?: number | null;
};
export type IEditTicketEntity = Pick<ITicketEntityBase, 'ticket_id'> & {
  bets: IBetTable[];
};
export type IEditTicketBaseEntity = Pick<ITicketEntityBase, 'ticket_id'> & {
  bets: IBetTableBase[];
};
export interface INewTicketBaseEntity extends ITicketEntityBase {
  bets: IBetTableBase[];
}

export type IDeleteTicketEntity = Pick<ITicketEntityBase, 'ticket_number'> &
  Partial<Pick<IUserEntityBack, 'user_type' | 'user_id'>>;

export type IGetTicketEntity = Partial<Pick<ITicketEntityBase, 'ticket_id' | 'ticket_number'>>;

export type IGetAllTicketEntity = Pick<IUserEntityBack, 'user_id' | 'user_type'> &
  Partial<Pick<ITicketEntityBase, 'date' | 'winner' | 'paid'>> & {
    organization_id: string;
    cashier_id?: string;
  };

export type IGetAllTicketByUserEntity = Pick<ITicketEntityBase, 'date' | 'user_id'> &
  Partial<Pick<ITicketEntityBase, 'winner'>>;

export interface ILotterySchedule {
  schedule: IScheduleEntityFront;
  lotteries: ILotteryEntityFront[];
}
export interface IBetTable {
  bet_order?: number;
  number: string;
  amount: number;
  place: PLACE_TYPE;
  with?: string | null;
  position?: PLACE_TYPE | null;
  scheduleLottery: ILotterySchedule[];
}

export type IBetTableBase = Omit<IBetTable, 'scheduleLottery'> & {
  scheduleLottery: {
    schedule: string;
    lotteries: string[];
  }[];
};

export type ITicketEntityFrontCompact = Omit<
  ITicketEntityBase,
  'created_at' | 'deleted_at' | 'organization_id'
> & {
  bets: IBetTable[];
};

export type IGetAllTicketNumberEntity = Pick<IUserEntityBack, 'user_id' | 'user_type'> &
  Partial<Pick<ITicketEntityBase, 'date' | 'winner'>> & { cashier_id?: string };

export type IPayTicketEntity = Pick<
  ITicketEntityBase,
  'ticket_number' | 'user_id' | 'organization_id'
>;
