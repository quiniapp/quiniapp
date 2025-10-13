import { BetRepository } from '../repository/bet.repository';
import { IBetEntityBack, IBetEntityFront } from '@helper/types/bet.type';
import { parseBet } from '../helper/parseBet';

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
  }): Promise<IBetEntityFront[]> => {
    let bets: IBetEntityBack[];
    try {
      if (grouped) {
        bets = await this.repository.getAllBetsGrouped({
          schedule_id,
          date,
          cashier_id,
          lottery_id,
          winners,
          tern,
          quatern,
        });
      } else {
        bets = await this.repository.getAllBets({
          schedule_id,
          date,
          cashier_id,
          lottery_id,
          winners,
          tern,
          quatern,
          ticket_number,
        });
      }
      return bets.map((bet) => {
        return parseBet(bet);
      });
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
