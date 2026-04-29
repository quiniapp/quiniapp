import { z } from 'zod';
import { dateRegex } from '../functions/dateRegex';
export const newResultsSchema = z.object({
  results: z
    .array(z.string().regex(/^\d{3,4}$/, { message: 'Debe tener 3 o 4 dígitos' }))
    .length(20, { message: 'Debe haber exactamente 20 números' })
    .superRefine((arr, ctx) => {
      const lengths = new Set(arr.map((r) => r.length));
      if (lengths.size > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Todos los resultados deben tener la misma cantidad de cifras (3 o 4)',
        });
      }
    }),
  lottery_id: z.string(),
  schedule_id: z.string(),
  date: z
    .string()
    .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'La fecha no es válida',
    })
    .optional(),
});

export const editResultsSchema = z.object({
  results: z
    .array(z.string().regex(/^\d{3,4}$/, { message: 'Debe tener 3 o 4 dígitos' }))
    .length(20, { message: 'Debe haber exactamente 20 números' })
    .superRefine((arr, ctx) => {
      const lengths = new Set(arr.map((r) => r.length));
      if (lengths.size > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Todos los resultados deben tener la misma cantidad de cifras (3 o 4)',
        });
      }
    })
    .optional(),
  lottery_id: z.string().optional(),
  schedule_id: z.string().optional(),
  date: z
    .string()
    .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'La fecha no es válida',
    })
    .optional(),
});

export const getResultsSchema = z.union([
  // Caso 1: solo results_id
  z.object({
    results_id: z.string(),
    date: z.undefined(),
    lottery_id: z.undefined(),
    schedule_id: z.undefined(),
  }),
  // Caso 2: date + lottery_id + schedule_id
  z.object({
    results_id: z.undefined(),
    date: z
      .string()
      .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'La fecha no es válida',
      }),
    lottery_id: z.string(),
    schedule_id: z.string(),
  }),
]);
