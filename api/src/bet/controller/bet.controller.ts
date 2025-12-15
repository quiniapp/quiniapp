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
    organization_id,
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
    organization_id: string;
    page?: number;
    limit?: number;
  }): Promise<IPaginatedBetsResponse<IBetEntityFront>> => {
    try {
      if (grouped) {
        // Grouped no tiene paginación por ahora, mantener comportamiento anterior
        const bets = await this.repository.getAllBetsGrouped({
          organization_id,
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
          organization_id,
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
            organization_id,
          });
          aggregates = {
            totalAmount: ticketSums.total_amount,
            totalPrize: ticketSums.total_prize,
            totalCount: ticketSums.total_count,
            totalWinnersCount: ticketSums.total_winners_count,
          };
        } else {
          // Obtener totales generales en paralelo
          const [totalAmount, totalPrize] = await Promise.all([
            this.repository.getTotalAmount({
              date,
              schedule_id,
              cashier_id,
              lottery_id,
              organization_id,
            }),
            this.repository.getTotalPrize({
              date,
              schedule_id,
              cashier_id,
              lottery_id,
              organization_id,
            }),
          ]);
          aggregates = {
            totalAmount,
            totalPrize,
          };
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
    organization_id,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    organization_id: string;
  }) => {
    try {
      const total = await this.repository.getTotalAmount({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_id,
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
    organization_id,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    organization_id: string;
  }) => {
    try {
      const total = await this.repository.getTotalPrize({
        date,
        schedule_id,
        cashier_id,
        lottery_id,
        organization_id,
      });
      return total;
    } catch (error) {
      console.error('GetTotalPrize error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAmountsByTicket = async ({
    ticket_number,
    organization_id,
  }: {
    ticket_number: string;
    organization_id: string;
  }) => {
    try {
      const totals = await this.repository.getAmountsByTicket({
        ticket_number,
        organization_id,
      });
      return totals;
    } catch (error) {
      console.error('getAmountsByTicket error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
