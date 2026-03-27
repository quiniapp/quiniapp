import { INewTicketBaseEntity, INewTicketEntity } from '@helper/request/ticket.request';
export declare const ticketBase: (
  ticket: INewTicketEntity
) => Omit<INewTicketBaseEntity, 'organization_id'>;
