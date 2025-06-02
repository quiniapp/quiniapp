import { INewBetEntity } from '@helper/request/bet.response';
import { IBetEntityBase } from '@helper/types/bet.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const betBase = (bet: INewBetEntity, ticket_id: string): IBetEntityBase => {
  const timestamp = dayjs().toISOString();
  return {
    ...bet,
    ticket_id: ticket_id,
    bet_id: uuidv4(),
    winner: false,
    paid: false,
    deleted_at: null,
    created_at: timestamp,
    edited_at: timestamp,
  };
};
