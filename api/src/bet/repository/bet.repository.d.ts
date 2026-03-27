import { TicketSums } from '@helper/request/bet.request';
import { IBetEntityBack } from '@helper/types/bet.type';
export declare class BetRepository {
  getAllBets({
    organization_ids,
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    quatern,
    tern,
    ticket_number,
    page,
    limit,
  }: {
    organization_ids: string[];
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    quatern?: boolean;
    tern?: boolean;
    ticket_number?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    count: number;
  }>;
  getAllBetsGrouped({
    organization_ids,
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    quatern,
    tern,
    page,
    limit,
  }: {
    organization_ids: string[];
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    quatern?: boolean;
    tern?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: IBetEntityBack[];
    count: number;
  }>;
  getTotalAmount({
    organization_ids,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    organization_ids: string[];
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }): Promise<number>;
  getTotalPrize({
    organization_ids,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    organization_ids: string[];
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }): Promise<number>;
  getWinnerBets({
    organization_id,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
    ticket_number,
  }: {
    organization_id: string;
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    ticket_number?: string;
  }): Promise<any[]>;
  getAmountsByTicket({
    ticket_number,
    organization_ids,
  }: {
    ticket_number: string;
    organization_ids: string[];
  }): Promise<TicketSums>;
}
