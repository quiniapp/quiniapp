import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IGetAllTicketEntity } from '@helper/request/ticket.request';
export declare class WinnerController {
  private repository;
  generateWinners: ({
    schedule_id,
    date,
    organization_id,
  }: {
    schedule_id: string;
    date: string;
    organization_id: string;
  }) => Promise<any>;
  getAllWinners: (props: IGetAllTicketEntity) => Promise<ITicketEntityFront[]>;
}
