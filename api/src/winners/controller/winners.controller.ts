import { USER_TYPE } from '@helper/types/user.type';
import { parseTicket } from 'api/src/ticket/helper/parseTicket';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IGetAllTicketEntity } from '@helper/request/ticket.response';
import { WinnerRepository } from '../repository/winners.repository';

export class WinnerController {
  private repository = new WinnerRepository();

  generateWinners = async (schedule_id: string, date: string) => {
    try {
      const response = await this.repository.generateWinners(schedule_id, date);
      return response;
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAllWinners = async (props: IGetAllTicketEntity): Promise<ITicketEntityFront[]> => {
    let winners;
    try {
      if (props.user_type === USER_TYPE.CASHIER) {
        winners = await this.repository.getAllWinners(props.user_id);
      } else {
        winners = await this.repository.getAllWinners();
      }

      return winners.map((winner) => {
        return parseTicket(winner);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
