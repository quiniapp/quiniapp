import { INewTicketEntity } from '@helper/request/ticket.response';
import { ITicketEntityBack } from '@helper/types/ticket.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { betBase } from 'api/src/bet/helper/betBase';

export const ticketBase = (ticket: INewTicketEntity): ITicketEntityBack => {
  const timestamp = dayjs().toISOString();
  const ticket_id = uuidv4();
  const ticket_number = +dayjs().format('YYYYMMDDHHmmssSSSS');

  const total = ticket.bets.reduce((prev, curr) => prev + curr.amount, 0);

  return {
    ...ticket,
    ticket_id,
    total,
    ticket_number,
    bets: ticket.bets.map((bet) => betBase(bet, ticket_id)),
    winner: false,
    paid: false,
    deleted_at: null,
    created_at: timestamp,
    deleted_by: null,
  };
};
