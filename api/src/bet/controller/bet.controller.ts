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
    group_user_ids,
    min_amount = 0,
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
    group_user_ids?: string[];
    min_amount?: number;
    page?: number;
    limit?: number;
  }): Promise<IPaginatedBetsResponse<IBetEntityFront>> => {
    try {
      if (grouped) {
        const { data: groupedBets, count } = await this.repository.getAllBetsGrouped({
          organization_ids,
          group_user_ids,
          schedule_id,
          date,
          cashier_id,
          lottery_id,
          winners,
          tern,
          quatern,
          min_amount,
          page,
          limit,
        });
        const parsedBets = groupedBets.map((bet: IBetEntityBack) => parseBet(bet));
        // Page 1: real count from DB. Pages 2+: count is 0 (not fetched to save a query).
        // Use length heuristic for hasMore on pages 2+: full page → maybe more rows exist.
        const totalCount = page === 1 ? count : 0;
        const totalPages = page === 1 ? Math.ceil(count / limit) : 0;
        const hasMore = page === 1 ? page < totalPages : parsedBets.length >= limit;
        return {
          data: parsedBets,
          pagination: {
            currentPage: page,
            pageSize: limit,
            totalCount,
            totalPages,
            hasMore,
          },
        };
      } else {
        // Con paginación
        const { data: bets, count } = await this.repository.getAllBets({
          organization_ids,
          group_user_ids,
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
        // count is 0 when PostgREST can't return it; fall back to length heuristic in that case
        const effectiveCount =
          count > 0
            ? count
            : parsedBets.length >= limit
              ? page * limit + 1 // full page → assume at least one more page exists
              : (page - 1) * limit + parsedBets.length; // partial page → this is the last
        const totalPages = Math.ceil(effectiveCount / limit);

        // Si hay ticket_number, obtener totales por ticket
        let aggregates: {
          totalAmount?: number;
          totalPrize?: number;
          totalCount?: number;
          totalWinnersCount?: number;
        } = {};

        if (ticket_number) {
          // Solo calcular sumas del ticket en la primera página
          if (page === 1) {
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
          }
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
                group_user_ids,
              }),
              this.repository.getTotalPrize({
                date,
                schedule_id,
                cashier_id,
                lottery_id,
                organization_ids,
                group_user_ids,
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
            totalCount: effectiveCount,
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
    group_user_ids,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    organization_ids: string[];
    group_user_ids?: string[];
  }) => {
    try {
      const total = await this.repository.getTotalAmount({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_ids,
        group_user_ids,
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
    group_user_ids,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    organization_ids: string[];
    group_user_ids?: string[];
  }) => {
    try {
      const total = await this.repository.getTotalPrize({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_ids,
        group_user_ids,
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
