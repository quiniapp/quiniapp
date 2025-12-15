import { TicketRepository } from '../repository/ticket.repository';
import {
  IBetTable,
  IDeleteTicketEntity,
  IEditTicketEntity,
  // IGetAllTicketByUserEntity,
  IGetAllTicketEntity,
  IGetTicketEntity,
  INewTicketEntity,
  IPayTicketEntity,
} from '@helper/request/ticket.response';
import { ticketBase } from '../helper/ticketBase';
import { parseTicket } from '../helper/parseTicket';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import { ERROR_MESSAGE } from '@helper/types/errors.type';
import { betBase } from 'src/bet/helper/betBase';
import { IPaginatedResponse } from '@helper/request/pagination.response';

export class TicketController {
  private repository = new TicketRepository();

  create = async (props: INewTicketEntity) => {
    const newTicket = ticketBase(props);
    try {
      const result = await this.repository.create({
        ...newTicket,
        organization_id: props.organization_id,
      });
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
        ticket = await this.repository.getById(props?.ticket_id, props.organization_id!);
      } else if (props.ticket_number) {
        ticket = await this.repository.getByNumber(props.ticket_number, props.organization_id!);
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

  getAll = async (
    props: IGetAllTicketEntity & { page?: number; limit?: number }
  ): Promise<IPaginatedResponse<ITicketEntityFront>> => {
    const page = props.page ?? 1;
    const limit = props.limit ?? 100;

    try {
      let result;
      if (props.user_type === USER_TYPE.CASHIER) {
        result = await this.repository.getAll({
          organization_id: props.organization_id,
          user_id: props.user_id,
          date: props.date ?? '',
          winner: props?.winner,
          paid: props?.paid,
          page,
          limit,
        });
      } else {
        result = await this.repository.getAll({
          organization_id: props.organization_id,
          date: props.date ?? '',
          user_id: props?.cashier_id,
          winner: props?.winner,
          paid: props?.paid,
          page,
          limit,
        });
      }

      const { data: tickets, count } = result;
      const parsedTickets = tickets.map((ticket) => parseTicket(ticket));

      const totalPages = Math.ceil(count / limit);

      return {
        data: parsedTickets,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalCount: count,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAllTicketNumber = async (
    props: IGetAllTicketEntity
  ): Promise<{ ticket_id: string; ticket_number: string }[]> => {
    let tickets;
    try {
      if (props.user_type === USER_TYPE.CASHIER) {
        tickets = await this.repository.getAllTicketNumber({
          organization_id: props.organization_id,
          user_id: props.user_id,
          date: props.date ?? '',
          winner: !!props.winner,
        });
      } else {
        tickets = await this.repository.getAllTicketNumber({
          organization_id: props.organization_id,
          date: props.date ?? '',
          user_id: props?.cashier_id,
          winner: !!props.winner,
        });
      }

      return tickets;
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (props: IDeleteTicketEntity) => {
    try {
      const ticket = await this.repository.getByNumber(props.ticket_number, props.organization_id);
      if (props.user_type === USER_TYPE.CASHIER) {
        if (dayjs().diff(ticket.created_at, 'minutes') > 2)
          throw new Error(ERROR_MESSAGE.INVALID_DELETE_TIME);
      }
      await this.repository.delete({ ...props, organization_id: props.organization_id });
      return;
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  // getAllByUser = async (props: IGetAllTicketByUserEntity): Promise<ITicketEntityFront[]> => {
  //   try {
  //     const tickets = await this.repository.getAll({
  //       user_id: props.user_id!,
  //       date: props.date,
  //       winner: props?.winner ?? false,
  //     });
  //     console.log('asdf', tickets)
  //     return tickets.map((ticket) => {
  //       return parseTicket(ticket);
  //     });
  //   } catch (error) {
  //     console.error('GetAll error:', error);
  //     throw error instanceof Error ? error : new Error('Unknown error');
  //   }
  // };
  getAllDeletedTickets = async ({
    user_id,
    date,
    organization_id,
  }: {
    user_id?: string;
    date: string;
    organization_id: string;
  }) => {
    try {
      const tickets = await this.repository.getAllDeletedTickets({
        organization_id,
        user_id: user_id,
        date: date,
      });

      return tickets;
    } catch (error) {
      console.error('getAllDeletedTickets error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  update = async (props: IEditTicketEntity) => {
    try {
      const updateBase = props.bets.map((b: IBetTable) => betBase(b));
      const ticket = await this.repository.update({
        bets: updateBase,
        ticket_id: props.ticket_id,
        organization_id: props.organization_id,
      });

      return parseTicket(ticket);
    } catch (error) {
      console.error('update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  paid = async ({ ticket_number, user_id, organization_id }: IPayTicketEntity) => {
    try {
      const result = await this.repository.payTicket({ ticket_number, user_id, organization_id });
      return result;
    } catch (error) {
      console.error('Paid error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
