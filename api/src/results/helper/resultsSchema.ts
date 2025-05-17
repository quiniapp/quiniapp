import { z } from 'zod';

export const newResultsSchema = z.object({
  results: z
    .array(z.number().int().min(1000).max(9999))
    .length(20, { message: 'Debe haber exactamente 20 números de 4 cifras' }),
  lottery_id: z.string(),
  schedule_id: z.string(),
  date: z.string().optional(),
});

export const editResultsSchema = z.object({
  results: z
    .array(z.number().int().min(1000).max(9999))
    .length(20, { message: 'Debe haber exactamente 20 números de 4 cifras' })
    .optional(),
  lottery_id: z.string().optional(),
  schedule_id: z.string().optional(),
  date: z.string().optional(),
});
