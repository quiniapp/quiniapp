import { z } from 'zod';

export const newBetSchema = z.object({
  bet_type: z.enum(['ONE', 'DOUBLE', 'TERN', 'QUATERN', 'BORRATINA', 'REDOUBLE']),
  user_id: z.string().uuid(),
  number: z.string().min(1), // o regex si tiene formato numérico fijo
  amount: z.number().min(0.01),
  place: z.enum(['HEAD', 'FIVE', 'TEN', 'TWENTY']),
  with: z.string().nullable().optional(),
  position: z.enum(['HEAD', 'FIVE', 'TEN', 'TWENTY']).nullable().optional(),
  date: z.string(), // podés usar z.string().refine(val => dayjs(val).isValid(), { message: 'Fecha inválida' })
  lottery_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
});
