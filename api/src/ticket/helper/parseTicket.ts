import { ITicketEntityFrontCompact } from '@helper/request/ticket.request';
import { ITicketEntityBack } from '@helper/types/ticket.type';
// import { parseBet } from 'api/src/bet/helper/parseBet';

export const parseTicket = (ticket: ITicketEntityBack): ITicketEntityFrontCompact => {
  return {
    bets: ticket.bets,
    date: ticket.date,
    deleted_by: ticket.deleted_by,
    paid: ticket.paid,
    ticket_id: ticket.ticket_id,
    ticket_number: ticket.ticket_number,
    total: ticket.total,
    user_id: ticket.user_id,
    user_name: ticket.user_name,
    winner: ticket.winner,
    total_prize: ticket.total_prize,
    hits: ticket.hits,
  };
};
