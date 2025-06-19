import { TicketRepository } from '../repository/ticket.repository';
import {
  IDeleteTicketEntity,
  IGetAllTicketEntity,
  IGetTicketEntity,
  INewTicketEntity,
} from 'helper/request/ticket.response';
import { ticketBase } from '../helper/ticketBase';
import { parseTicket } from '../helper/parseTicket';
import { ITicketEntityFront } from 'helper/types/ticket.type';
import { USER_TYPE } from 'helper/types/user.type';
import dayjs from 'dayjs';
import { ERROR_MESSAGE } from 'helper/types/errors.type';

export class TicketController {
  private repository = new TicketRepository();

  create = async (props: INewTicketEntity) => {
    const newTicket = ticketBase(props);
    try {
      const result = await this.repository.create(newTicket);
      return parseTicket(result);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  get = async (props: IGetTicketEntity): Promise<ITicketEntityFront> => {
    try {
      const ticket = await this.repository.getById(props?.ticket_id ?? '');
      return parseTicket(ticket);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (props: IGetAllTicketEntity): Promise<ITicketEntityFront[]> => {
    let tickets;
    try {
      if (props.user_type === USER_TYPE.CASHIER) {
        tickets = await this.repository.getAll(props.user_id);
      } else {
        tickets = await this.repository.getAll();
      }

      return tickets.map((ticket) => {
        return parseTicket(ticket);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (props: IDeleteTicketEntity) => {
    try {
      const ticket = await this.repository.getById(props.ticket_id);
      if (props.user_type === USER_TYPE.CASHIER) {
        if (dayjs().diff(ticket.created_at, 'minutes') > 2)
          throw new Error(ERROR_MESSAGE.INVALID_DELETE_TIME);
      }

      await this.repository.delete(props);
      return;
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
