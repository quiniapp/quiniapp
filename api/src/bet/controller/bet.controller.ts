import { BetRepository } from '../repository/bet.repository';
import { IBetEntityBack, IBetEntityFront } from 'helper/types/bet.type';
import { parseBet } from '../helper/parseBet';

export class BetController {
  private repository = new BetRepository();

  getAllBets = async ({
    schedule_id,
    date,
    cashier_id,
    lottery_id,
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
  }): Promise<IBetEntityFront[]> => {
    try {
      const bets: IBetEntityBack[] = await this.repository.getAllBets({
        schedule_id,
        date,
        cashier_id,
        lottery_id,
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
