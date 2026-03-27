import { IBetEntityFront } from '@helper/types/bet.type';
import { IPaginatedBetsResponse } from '@helper/request/pagination.request';
export declare class BetController {
  private repository;
  getAllBets: ({
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    grouped,
    tern,
    quatern,
    ticket_number,
    organization_ids,
    page,
    limit,
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    grouped?: boolean;
    tern?: boolean;
    quatern?: boolean;
    ticket_number?: string;
    organization_ids: string[];
    page?: number;
    limit?: number;
  }) => Promise<IPaginatedBetsResponse<IBetEntityFront>>;
  getTotalAmount: ({
    date,
    schedule_id,
    cashier_id,
    lottery_id,
    organization_ids,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    organization_ids: string[];
  }) => Promise<number>;
  getTotalPrize: ({
    date,
    schedule_id,
    cashier_id,
    lottery_id,
    organization_ids,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    organization_ids: string[];
  }) => Promise<number>;
  getAmountsByTicket: ({
    ticket_number,
    organization_ids,
  }: {
    ticket_number: string;
    organization_ids: string[];
  }) => Promise<import('@helper/request/bet.request').TicketSums>;
}
