import { z } from 'zod';
import { dateRegex } from '../functions/dateRegex';

export const newPollaEditionSchema = z
  .object({
    lottery_id: z.string().uuid(),
    schedule_id: z.string().uuid(),
    start_date: z.string().regex(dateRegex),
    end_date: z.string().regex(dateRegex),
    load_limit_date: z.string().regex(dateRegex),
    pool_amount: z.number().min(0),
    ticket_price: z.number().min(0.01),
  })
  .superRefine((data, ctx) => {
    if (data.load_limit_date >= data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['load_limit_date'],
        message: 'La fecha límite de carga debe ser anterior a la fecha de inicio',
      });
    }
    if (data.start_date > data.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_date'],
        message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
      });
    }
  });

export const updatePollaEditionSchema = z
  .object({
    lottery_id: z.string().uuid().optional(),
    schedule_id: z.string().uuid().optional(),
    start_date: z.string().regex(dateRegex).optional(),
    end_date: z.string().regex(dateRegex).optional(),
    load_limit_date: z.string().regex(dateRegex).optional(),
    pool_amount: z.number().min(0).optional(),
    ticket_price: z.number().min(0.01).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.load_limit_date && data.start_date && data.load_limit_date >= data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['load_limit_date'],
        message: 'La fecha límite de carga debe ser anterior a la fecha de inicio',
      });
    }
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_date'],
        message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
      });
    }
  });
