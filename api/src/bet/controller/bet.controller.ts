import { BetRepository } from '../repository/bet.repository';
import { IBetEntityBack, IBetEntityFront } from '@helper/types/bet.type';
import { parseBet } from '../helper/parseBet';
import { IPaginatedBetsResponse } from '@helper/request/pagination.response';

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
    page?: number;
    limit?: number;
  }): Promise<IPaginatedBetsResponse<IBetEntityFront>> => {
    try {
      if (grouped) {
        // Grouped no tiene paginación por ahora, mantener comportamiento anterior
        const bets = await this.repository.getAllBetsGrouped({
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

        // Obtener totales en paralelo
        const [totalAmount, totalPrize] = await Promise.all([
          this.repository.getTotalAmount({ date, schedule_id, cashier_id, lottery_id }),
          this.repository.getTotalPrize({ date, schedule_id, cashier_id, lottery_id }),
        ]);

        const parsedBets = bets.map((bet) => parseBet(bet));
        const totalPages = Math.ceil(count / limit);

        return {
          data: parsedBets,
          pagination: {
            currentPage: page,
            pageSize: limit,
            totalCount: count,
            totalPages,
            hasMore: page < totalPages,
          },
          aggregates: {
            totalAmount,
            totalPrize,
          },
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
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }) => {
    try {
      const total = await this.repository.getTotalAmount({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
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
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }) => {
    try {
      const total = await this.repository.getTotalPrize({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
      });
      return total;
    } catch (error) {
      console.error('GetTotalPrize error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
