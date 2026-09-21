import { z } from 'zod';

const twoDigitNumber = z.string().regex(/^\d{2}$/, 'Debe ser un número de 2 cifras (00-99)');

export const newPollaBetSchema = z
  .object({
    polla_edition_id: z.string().uuid(),
    user_id: z.string().uuid().nullable(),
    user_name: z.string().min(1),
    numbers: z.array(twoDigitNumber).length(10, 'Debe elegir exactamente 10 números'),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.numbers).size !== data.numbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numbers'],
        message: 'Los 10 números deben ser distintos',
      });
    }
  });

export const updatePollaBetSchema = z
  .object({
    numbers: z.array(twoDigitNumber).length(10, 'Debe elegir exactamente 10 números'),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.numbers).size !== data.numbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numbers'],
        message: 'Los 10 números deben ser distintos',
      });
    }
  });
