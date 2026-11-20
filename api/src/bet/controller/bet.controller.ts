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
    cursor = '',
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
    /** Modo agrupado (offset). */
    page?: number;
    /** Modo lista (keyset); vacío = primera página. */
    cursor?: string;
    limit?: number;
  }): Promise<IPaginatedBetsResponse<IBetEntityFront>> => {
    // Totales del día ("Total monto de jugadas / aciertos"): filtros base, sin
    // ganadores/terna/cuaterna/monto mínimo (semántica vigente, ver
    // docs/plan-rendimiento-sql.md).
    const totalsFilters = {
      date,
      schedule_id,
      cashier_id,
      lottery_id,
      organization_ids,
      group_user_ids,
    };

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

        let aggregates: { totalAmount?: number; totalPrize?: number } = {};
        if (page === 1) {
          const [totalAmount, totalPrize] = await Promise.all([
            this.repository.getTotalAmount(totalsFilters),
            this.repository.getTotalPrize(totalsFilters),
          ]);
          aggregates = { totalAmount, totalPrize };
        }

        return {
          data: parsedBets,
          pagination: {
            currentPage: page,
            pageSize: limit,
            totalCount,
            totalPages,
            hasMore,
          },
          aggregates,
        };
      } else {
        // Modo lista: keyset. Los totales del día van solo en la primera request
        // (sin cursor) y en paralelo con la página. Con ticket_number no se
        // calculan: el detalle del ticket usa GET /bet/amounts.
        const isFirstRequest = !cursor;
        const withTotals = isFirstRequest && !ticket_number;

        const [page, totalAmount, totalPrize] = await Promise.all([
          this.repository.getAllBets({
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
            cursor,
            limit,
          }),
          withTotals ? this.repository.getTotalAmount(totalsFilters) : undefined,
          withTotals ? this.repository.getTotalPrize(totalsFilters) : undefined,
        ]);

        return {
          data: page.data.map((bet) => parseBet(bet)),
          pagination: {
            pageSize: limit,
            hasMore: page.hasMore,
            next_cursor: page.next_cursor,
          },
          // Pages siguientes no recalculan: el frontend usa data.pages[0].aggregates.
          aggregates: withTotals ? { totalAmount, totalPrize } : {},
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
