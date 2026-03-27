import { BetRepository } from '../repository/bet.repository';
import { IBetEntityBack, IBetEntityFront } from '@helper/types/bet.type';
import { parseBet } from '../helper/parseBet';
import { IPaginatedBetsResponse } from '@helper/request/pagination.request';

export class BetController {
  private repository = new BetRepository();

  getAllBets = async ({
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
    page = 1,
    limit = 100,
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
  }): Promise<IPaginatedBetsResponse<IBetEntityFront>> => {
    try {
      if (grouped) {
        // Grouped no tiene paginación por ahora, mantener comportamiento anterior
        const bets = await this.repository.getAllBetsGrouped({
          organization_ids,
          schedule_id,
          date,
          cashier_id,
          lottery_id,
          winners,
          tern,
          quatern,
        });
        const parsedBets = bets.map((bet: IBetEntityBack) => parseBet(bet));
        return {
          data: parsedBets,
          pagination: {
            currentPage: 1,
            pageSize: parsedBets.length,
            totalCount: parsedBets.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      } else {
        // Con paginación
        const { data: bets, count } = await this.repository.getAllBets({
          organization_ids,
          schedule_id,
          date,
          cashier_id,
          lottery_id,
          winners,
          tern,
          quatern,
          ticket_number,
          page,
          limit,
        });

        const parsedBets = bets.map((bet) => parseBet(bet));
        const totalPages = Math.ceil(count / limit);

        // Si hay ticket_number, obtener totales por ticket
        let aggregates: {
          totalAmount?: number;
          totalPrize?: number;
          totalCount?: number;
          totalWinnersCount?: number;
        } = {};

        if (ticket_number) {
          const ticketSums = await this.repository.getAmountsByTicket({
            ticket_number,
            organization_ids,
          });
          aggregates = {
            totalAmount: ticketSums?.total_amount ?? 0,
            totalPrize: ticketSums?.total_prize ?? 0,
            totalCount: ticketSums?.total_count ?? 0,
            totalWinnersCount: ticketSums?.total_winners_count ?? 0,
          };
        } else {
          // Solo calcular totales en la primera página — no cambian entre páginas
          if (page === 1) {
            const [totalAmount, totalPrize] = await Promise.all([
              this.repository.getTotalAmount({
                date,
                schedule_id,
                cashier_id,
                lottery_id,
                organization_ids,
              }),
              this.repository.getTotalPrize({
                date,
                schedule_id,
                cashier_id,
                lottery_id,
                organization_ids,
              }),
            ]);
            aggregates = {
              totalAmount,
              totalPrize,
            };
          }
          // Pages 2+ no recalculan — el frontend usa data?.pages?.[0]?.aggregates
        }

        return {
          data: parsedBets,
          pagination: {
            currentPage: page,
            pageSize: limit,
            totalCount: count,
            totalPages,
            hasMore: page < totalPages,
          },
          aggregates,
        };
      }
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getTotalAmount = async ({
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
  }) => {
    try {
      const total = await this.repository.getTotalAmount({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_ids,
      });
      return total;
    } catch (error) {
      console.error('GetTotalAmount error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getTotalPrize = async ({
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
  }) => {
    try {
      const total = await this.repository.getTotalPrize({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_ids,
      });
      return total;
    } catch (error) {
      console.error('GetTotalPrize error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAmountsByTicket = async ({
    ticket_number,
    organization_ids,
  }: {
    ticket_number: string;
    organization_ids: string[];
  }) => {
    try {
      // Repository handles searching in both main and archive tables
      const totals = await this.repository.getAmountsByTicket({
        ticket_number,
        organization_ids,
      });
      return totals;
    } catch (error) {
      console.error('getAmountsByTicket error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
