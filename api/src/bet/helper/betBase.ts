import { INewBetEntity } from '@helper/request/bet.response';
import { IBetEntityBase } from '@helper/types/bet.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
export const betBase = (
  bet: INewBetEntity,
  ticket_id: string,
  ticket_number: string
): IBetEntityBase => {
  const timestamp = dayjs().tz('America/Argentina/Buenos_Aires');
  return {
    ...bet,
    ticket_id: ticket_id,
    bet_id: uuidv4(),
    winner: false,
    paid: false,
    deleted_at: null,
    created_at: timestamp.toISOString(),
    edited_at: timestamp.toISOString(),
    prize: 0,
    hits: 0,
    date: timestamp.format('YYYY-MM-DD'),
    ticket_number,
  };
};
