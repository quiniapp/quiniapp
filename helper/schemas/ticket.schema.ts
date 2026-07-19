import { BetTableSchema } from './bet.schema';
import { dateRegex } from '../functions/dateRegex';
import { z } from 'zod';

export const newTicketSchema = z.object({
  user_id: z.string().uuid().nullable(),
  user_name: z.string().min(1),
  date: z.string().regex(dateRegex),
  bets: z.array(BetTableSchema).min(1),
  client_request_id: z.string().uuid().optional(),
});
