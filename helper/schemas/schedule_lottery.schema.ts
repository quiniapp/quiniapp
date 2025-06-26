import { z } from 'zod';

export const scheduleLotteriesSchema = z.object({
  day: z
    .number()
    .int()
    .min(0, { message: 'El día debe ser entre 0 (domingo) y 6 (sábado)' })
    .max(6, { message: 'El día debe ser entre 0 (domingo) y 6 (sábado)' }),
  lotteries: z.array(z.string()),
});
