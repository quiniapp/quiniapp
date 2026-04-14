import { BetTableSchema } from './bet.schema';
import { z } from 'zod';

export const newTicketSchema = z.object({
  user_id: z.string().uuid().nullable(),
  user_name: z.string().min(1),
  date: z.string(),
  bets: z.array(BetTableSchema).min(1),
  client_request_id: z.string().uuid().optional(),
});
