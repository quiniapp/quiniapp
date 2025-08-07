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
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    grouped?: boolean;
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
        });
      }
      bets = await this.repository.getAllBets({
        schedule_id,
        date,
        cashier_id,
        lottery_id,
        winners,
      });

      return bets.map((bet) => {
        return parseBet(bet);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
