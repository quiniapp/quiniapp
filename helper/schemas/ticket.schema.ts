import { dateRegex } from '@helper/functions/dateRegex';
import { newBetSchema } from '@helper/schemas/bet.schema';
import { z } from 'zod';

export const newTicketSchema = z.object({
  user_id: z.string().uuid().nullable(),
  user_name: z.string().min(1),
  date: z
    .string()
    .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'La fecha no es válida',
    }),
  bets: z.array(newBetSchema).min(1),
});
