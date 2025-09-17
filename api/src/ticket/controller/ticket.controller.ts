import { TicketRepository } from '../repository/ticket.repository';
import {
  IDeleteTicketEntity,
  IEditTicketEntity,
  IGetAllTicketByUserEntity,
  IGetAllTicketEntity,
  IGetTicketEntity,
  INewTicketEntity,
} from '@helper/request/ticket.response';
import { ticketBase } from '../helper/ticketBase';
import { parseTicket } from '../helper/parseTicket';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import { ERROR_MESSAGE } from '@helper/types/errors.type';

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
      let ticket;
      if (props.ticket_id) {
        ticket = await this.repository.getById(props?.ticket_id);
      } else if (props.ticket_number) {
        ticket = await this.repository.getByNumber(props.ticket_number);
      }
      if (!ticket) {
        // lanzar error controlado o devolver null y que router lo traduzca
        const err = new Error(ERROR_MESSAGE.TICKET_NOT_FOUND);
        throw err;
      }
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
        tickets = await this.repository.getAll({
          user_id: props.user_id,
          date: props.date,
          winner: props.winner,
        });
      } else {
        tickets = await this.repository.getAll({
          date: props.date,
          user_id: props?.cashier_id,
          winner: props.winner,
        });
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
      const ticket = await this.repository.getByNumber(props.ticket_number);
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
  getAllByUser = async (props: IGetAllTicketByUserEntity): Promise<ITicketEntityFront[]> => {
    try {
      const tickets = await this.repository.getAll({
        user_id: props.user_id!,
        date: props.date,
        winner: props?.winner ?? false,
      });

      return tickets.map((ticket) => {
        return parseTicket(ticket);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  getAllDeletedTickets = async ({ user_id, date }: { user_id: string; date: string }) => {
    try {
      const tickets = await this.repository.getAllDeletedTickets({
        user_id: user_id,
        date: date,
      });

      return tickets;
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  update = async (props: IEditTicketEntity) => {
    try {
      const ticket = await this.repository.update(props);

      return parseTicket(ticket);
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
