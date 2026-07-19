import { IBetTable, INewTicketBaseEntity, INewTicketEntity } from '@helper/request/ticket.request';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { betBase } from 'api/src/bet/helper/betBase';
import { dateRegex } from '@helper/functions/dateRegex';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const ticketBase = (
  ticket: INewTicketEntity,
  options?: { allowCustomDate?: boolean }
): Omit<INewTicketBaseEntity, 'organization_id'> => {
  const timestamp = dayjs().tz('America/Argentina/Buenos_Aires');
  const ticket_id = uuidv4();
  const base = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYYMMDDHHmmssSSS');
  const ticket_number = ticket.user_number != null ? `${base}-${ticket.user_number}` : base;

  const total = ticket.bets.reduce((prev, curr) => prev + curr.amount, 0);

  // Roles no-cajero pueden backdatear el ticket; nunca fechas futuras.
  // created_at y ticket_number siempre reflejan el momento real de creación (auditoría).
  const serverToday = timestamp.format('YYYY-MM-DD');
  const useCustomDate =
    options?.allowCustomDate === true &&
    typeof ticket.date === 'string' &&
    dateRegex.test(ticket.date) &&
    !dayjs(ticket.date).isAfter(serverToday, 'day');

  return {
    ...ticket,
    ticket_id: ticket_id,
    total: total,
    ticket_number: ticket_number,
    bets: ticket.bets.map((b: IBetTable) => betBase(b)),
    winner: false,
    paid: false,
    deleted_at: null,
    created_at: timestamp.toISOString(),
    deleted_by: null,
    total_prize: 0,
    hits: 0,
    date: useCustomDate ? ticket.date : serverToday,
  };
};
