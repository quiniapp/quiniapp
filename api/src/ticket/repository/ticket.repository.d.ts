import {
  IDeleteTicketEntity,
  IEditTicketBaseEntity,
  INewTicketBaseEntity,
  IPayTicketEntity,
} from '@helper/request/ticket.request';
import { ITicketEntityBack } from '@helper/types/ticket.type';
export declare class TicketRepository {
  create(
    ticket: INewTicketBaseEntity & {
      organization_id: string;
    }
  ): Promise<any>;
  getById(id: string, organization_id: string): Promise<any>;
  getByNumber(ticket_number: string, organization_id: string): Promise<any>;
  getAll({
    organization_id,
    user_id,
    date,
    winner,
    paid,
    page,
    limit,
  }: {
    organization_id: string;
    user_id?: string;
    date: string;
    winner?: boolean;
    paid?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    count: number;
  }>;
  delete(
    props: IDeleteTicketEntity & {
      organization_id: string;
    }
  ): Promise<
    | {
        tickets: never[];
        bets: never[];
        ticket?: undefined;
      }
    | {
        ticket: {
          ticket_id: any;
        }[];
        bets: null;
        tickets?: undefined;
      }
  >;
  getAllDeletedTickets({
    organization_id,
    user_id,
    date,
  }: {
    organization_id: string;
    user_id?: string;
    date: string;
  }): Promise<number>;
  update(
    props: IEditTicketBaseEntity & {
      organization_id: string;
    }
  ): Promise<ITicketEntityBack>;
  getAllTicketNumber({
    organization_id,
    user_id,
    date,
    winner,
  }: {
    organization_id: string;
    user_id?: string;
    date: string;
    winner: boolean;
  }): Promise<
    {
      ticket_id: any;
      ticket_number: any;
    }[]
  >;
  payTicket({
    ticket_number,
    user_id,
    organization_id,
  }: IPayTicketEntity & {
    organization_id: string;
  }): Promise<{
    success: boolean;
    ticket_id: string;
    bets_updated: number;
  }>;
}
