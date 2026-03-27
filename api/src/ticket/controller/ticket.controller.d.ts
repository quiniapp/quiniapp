import {
  IDeleteTicketEntity,
  IEditTicketEntity,
  IGetAllTicketEntity,
  IGetTicketEntity,
  INewTicketEntity,
  IPayTicketEntity,
} from '@helper/request/ticket.request';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IPaginatedResponse } from '@helper/request/pagination.request';
export declare class TicketController {
  private repository;
  create: (
    props: INewTicketEntity,
    organization_id: string
  ) => Promise<import('@helper/request/ticket.request').ITicketEntityFrontCompact>;
  get: (props: IGetTicketEntity, organization_id: string) => Promise<ITicketEntityFront>;
  getAll: (
    props: IGetAllTicketEntity & {
      page?: number;
      limit?: number;
    }
  ) => Promise<IPaginatedResponse<ITicketEntityFront>>;
  getAllTicketNumber: (props: IGetAllTicketEntity) => Promise<
    {
      ticket_id: string;
      ticket_number: string;
    }[]
  >;
  delete: (props: IDeleteTicketEntity, organization_id: string) => Promise<void>;
  getAllDeletedTickets: ({
    user_id,
    date,
    organization_id,
  }: {
    user_id?: string;
    date: string;
    organization_id: string;
  }) => Promise<number>;
  update: (
    props: IEditTicketEntity,
    organization_id: string
  ) => Promise<import('@helper/request/ticket.request').ITicketEntityFrontCompact>;
  paid: ({ ticket_number, user_id, organization_id }: IPayTicketEntity) => Promise<{
    success: boolean;
    ticket_id: string;
    bets_updated: number;
  }>;
}
