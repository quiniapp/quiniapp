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
} from '@helper/request/ticket.request';
import { ticketBase } from '../helper/ticketBase';
import { parseTicket } from '../helper/parseTicket';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import { NotFoundError, InvalidDeleteTimeError } from '@helper/errors';
import { betBase } from 'src/bet/helper/betBase';
import { IPaginatedResponse } from '@helper/request/pagination.request';

export class TicketController {
  private repository = new TicketRepository();

  create = async (props: INewTicketEntity, organization_id: string) => {
    const newTicket = ticketBase(props);
    const result = await this.repository.create({
      ...newTicket,
      organization_id: organization_id,
    });
    return parseTicket(result);
  };
  get = async (props: IGetTicketEntity, organization_id: string): Promise<ITicketEntityFront> => {
    let ticket;
    if (props.ticket_id) {
      ticket = await this.repository.getById(props?.ticket_id, organization_id);
    } else if (props.ticket_number) {
      ticket = await this.repository.getByNumber(props.ticket_number, organization_id);
    }
    if (!ticket) {
      throw new NotFoundError('Ticket');
    }
    return parseTicket(ticket);
  };

  getAll = async (
    props: IGetAllTicketEntity & { page?: number; limit?: number }
  ): Promise<IPaginatedResponse<ITicketEntityFront>> => {
    const page = props.page ?? 1;
    const limit = props.limit ?? 100;

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
  };

  getAllTicketNumber = async (
    props: IGetAllTicketEntity
  ): Promise<{ ticket_id: string; ticket_number: string }[]> => {
    let tickets;
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
  };

  delete = async (props: IDeleteTicketEntity, organization_id: string) => {
    const ticket = await this.repository.getByNumber(props.ticket_number, organization_id);
    if (props.user_type === USER_TYPE.CASHIER) {
      if (dayjs().diff(ticket.created_at, 'minutes') > 2) {
        throw new InvalidDeleteTimeError();
      }
    }
    await this.repository.delete({ ...props, organization_id: organization_id });
    return;
  };
  getAllDeletedTickets = async ({
    user_id,
    date,
    organization_id,
  }: {
    user_id?: string;
    date: string;
    organization_id: string;
  }) => {
    const tickets = await this.repository.getAllDeletedTickets({
      organization_id,
      user_id: user_id,
      date: date,
    });

    return tickets;
  };
  update = async (props: IEditTicketEntity, organization_id: string) => {
    const updateBase = props.bets.map((b: IBetTable) => betBase(b));
    const ticket = await this.repository.update({
      bets: updateBase,
      ticket_id: props.ticket_id,
      organization_id: organization_id,
    });

    return parseTicket(ticket);
  };

  paid = async ({ ticket_number, user_id, organization_id }: IPayTicketEntity) => {
    const result = await this.repository.payTicket({ ticket_number, user_id, organization_id });
    return result;
  };
}
