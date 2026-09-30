import { z } from 'zod';
import { dateRegex } from '../../functions/dateRegex';
import { POLLA_NUMBERS_REQUIRED } from '../types/game.type';

const isoDate = z.string().regex(dateRegex, 'Fecha inválida (YYYY-MM-DD)');
const twoDigitNumber = z.string().regex(/^\d{2}$/, 'Debe ser un número de 2 cifras (00-99)');

const distinctNumbers = z
  .array(twoDigitNumber)
  .length(POLLA_NUMBERS_REQUIRED, `Debe elegir exactamente ${POLLA_NUMBERS_REQUIRED} números`)
  .superRefine((numbers, ctx) => {
    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Los ${POLLA_NUMBERS_REQUIRED} números deben ser distintos`,
      });
    }
  });

// --------------------------------------------------------------- ediciones

const editionDates = (data: { load_limit_date?: string; start_date?: string; end_date?: string }) =>
  data;

export const newPollaEditionSchema = z
  .object({
    polla_lottery_id: z.string().uuid(),
    polla_schedule_id: z.string().uuid(),
    polla_organization_id: z.string().uuid().optional(),
    name: z.string().max(120).nullable().optional(),
    start_date: isoDate,
    end_date: isoDate,
    load_limit_date: isoDate,
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
    polla_lottery_id: z.string().uuid().optional(),
    polla_schedule_id: z.string().uuid().optional(),
    name: z.string().max(120).nullable().optional(),
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
    load_limit_date: isoDate.optional(),
    pool_amount: z.number().min(0).optional(),
    ticket_price: z.number().min(0.01).optional(),
  })
  .superRefine((data, ctx) => {
    const d = editionDates(data);
    if (d.load_limit_date && d.start_date && d.load_limit_date >= d.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['load_limit_date'],
        message: 'La fecha límite de carga debe ser anterior a la fecha de inicio',
      });
    }
    if (d.start_date && d.end_date && d.start_date > d.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_date'],
        message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
      });
    }
  });

// -------------------------------------------------------------- resultados

/** Igual que QuiniApp: 20 números, todos del mismo largo (3 o 4 cifras). */
const resultNumbers = z
  .array(z.string().regex(/^\d{3,4}$/, 'Cada resultado debe tener 3 o 4 cifras'))
  .length(20, 'Se cargan exactamente 20 resultados')
  .superRefine((results, ctx) => {
    const lengths = new Set(results.map((r) => r.length));
    if (lengths.size > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Todos los resultados deben tener la misma cantidad de cifras',
      });
    }
  });

export const newPollaResultSchema = z.object({
  polla_lottery_id: z.string().uuid(),
  polla_schedule_id: z.string().uuid(),
  polla_organization_id: z.string().uuid().optional(),
  date: isoDate,
  results: resultNumbers,
});

export const updatePollaResultSchema = z.object({
  results: resultNumbers,
});

export const processPollaResultsSchema = z.object({
  polla_schedule_id: z.string().uuid(),
  date: isoDate,
  polla_organization_id: z.string().uuid().optional(),
});

// ----------------------------------------------------------------- jugadas

export const newPollaBetSchema = z.object({
  polla_edition_id: z.string().uuid(),
  /** Dueño de la jugada. Si falta, el backend usa al usuario autenticado. */
  polla_user_id: z.string().uuid().optional(),
  numbers: distinctNumbers,
  date: isoDate.optional(),
});

export const updatePollaBetSchema = z.object({
  numbers: distinctNumbers,
});

// -------------------------------------------------------- cuenta corriente

export const pollaCurrentAccountUpdateSchema = z.object({
  claims: z.number().optional(),
  collections: z.number().optional(),
  paid: z.number().optional(),
  bills: z.number().optional(),
  previous_balance: z.number().optional(),
  previous_drag: z.number().optional(),
});

export const pollaCurrentAccountBulkUpdateSchema = z.object({
  date: isoDate,
  updates: z
    .array(
      z.object({
        polla_current_account_id: z.string().uuid(),
        props: pollaCurrentAccountUpdateSchema,
      })
    )
    .min(1),
});

export type INewPollaEditionPayload = z.infer<typeof newPollaEditionSchema>;
export type INewPollaResultPayload = z.infer<typeof newPollaResultSchema>;
export type INewPollaBetPayload = z.infer<typeof newPollaBetSchema>;
export type IUpdatePollaBetPayload = z.infer<typeof updatePollaBetSchema>;
export type IPollaCurrentAccountUpdatePayload = z.infer<typeof pollaCurrentAccountUpdateSchema>;
