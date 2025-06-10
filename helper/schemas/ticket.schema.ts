import { newBetSchema } from '@helper/schemas/bet.schema';
import { z } from 'zod';

export const newTicketSchema = z.object({
  user_id: z.string().uuid().nullable(),
  user_name: z.string().min(1),
  date: z.string(),
  bets: z.array(newBetSchema).min(1),
});
