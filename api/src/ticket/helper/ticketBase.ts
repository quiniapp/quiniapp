import { INewTicketBaseEntity, INewTicketEntity } from '@helper/request/ticket.response';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { betBase } from 'api/src/bet/helper/betBase';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const ticketBase = (ticket: INewTicketEntity): INewTicketBaseEntity => {
  const timestamp = dayjs().toISOString();
  const ticket_id = uuidv4();
  const ticket_number = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYYMMDDHHmmssSSS');

  const total = ticket.bets.reduce((prev, curr) => prev + curr.amount, 0);

  return {
    ...ticket,
    ticket_id: ticket_id,
    total: total,
    ticket_number: ticket_number,
    bets: ticket.bets.map((bet) => betBase(bet, ticket_id)),
    winner: false,
    paid: false,
    deleted_at: null,
    created_at: timestamp,
    deleted_by: null,
    total_prize: 0,
    hits: 0,
  };
};
