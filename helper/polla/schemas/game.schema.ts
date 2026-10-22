import { z } from 'zod';
import { dateRegex } from '../../functions/dateRegex';
import { POLLA_NUMBERS_REQUIRED } from '../types/game.type';

const isoDate = z.string().regex(dateRegex, 'Fecha inválida (YYYY-MM-DD)');
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (HH:mm)');
const twoDigitNumber = z.string().regex(/^\d{2}$/, 'Debe ser un número de 2 cifras (00-99)');

/** Se permiten repetidos: cada aparición de un número es un casillero propio. */
const betNumbers = z
  .array(twoDigitNumber)
  .length(POLLA_NUMBERS_REQUIRED, `Debe elegir exactamente ${POLLA_NUMBERS_REQUIRED} números`);

// --------------------------------------------------------------- ediciones

const editionDates = (data: { load_limit_date?: string; start_date?: string; end_date?: string }) =>
  data;

/**
 * El cierre de carga puede ser el mismo día del primer sorteo (polla de un
 * día); que sea antes de la hora del turno lo valida la base, que la conoce.
 */
const LOAD_LIMIT_MESSAGE = 'El cierre de carga no puede ser después de la fecha de inicio';

export const newPollaEditionSchema = z
  .object({
    polla_lottery_id: z.string().uuid(),
    polla_schedule_id: z.string().uuid(),
    polla_organization_id: z.string().uuid().optional(),
    name: z.string().max(120).nullable().optional(),
    start_date: isoDate,
    end_date: isoDate,
    load_limit_date: isoDate,
    load_limit_time: clockTime,
    pool_amount: z.number().min(0),
    surprise_pool_amount: z.number().min(0).optional(),
    ticket_price: z.number().min(0.01),
  })
  .superRefine((data, ctx) => {
    if (data.load_limit_date > data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['load_limit_date'],
        message: LOAD_LIMIT_MESSAGE,
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
    load_limit_time: clockTime.optional(),
    pool_amount: z.number().min(0).optional(),
    surprise_pool_amount: z.number().min(0).optional(),
    /** Vale para las jugadas nuevas: las cargadas conservan su precio. */
    ticket_price: z.number().min(0.01).optional(),
  })
  .superRefine((data, ctx) => {
    const d = editionDates(data);
    if (d.load_limit_date && d.start_date && d.load_limit_date > d.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['load_limit_date'],
        message: LOAD_LIMIT_MESSAGE,
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

/**
 * 20 números de 2 cifras (00 a 99), como texto: se comparan tal cual con los
 * números jugados.
 */
const resultNumbers = z.array(twoDigitNumber).length(20, 'Se cargan exactamente 20 resultados');

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
  numbers: betNumbers,
  date: isoDate.optional(),
});

export const updatePollaBetSchema = z.object({
  numbers: betNumbers,
});

/** Tope de tickets por lote al repetir (con o sin cargo). */
export const POLLA_REPEAT_MAX_BETS = 500;

/**
 * Repetir tickets en una edición, cada uno a nombre de su dueño original. Sin
 * cargo (`/bet/free-repeat`) solo para admin+ y tickets de ediciones
 * finalizadas.
 */
export const repeatPollaBetsSchema = z.object({
  polla_edition_id: z.string().uuid(),
  polla_bet_ids: z
    .array(z.string().uuid())
    .min(1, 'Elegí al menos un ticket')
    .max(POLLA_REPEAT_MAX_BETS, `Se repiten hasta ${POLLA_REPEAT_MAX_BETS} tickets por vez`),
});

// -------------------------------------------------------- cuenta corriente

export const pollaCurrentAccountUpdateSchema = z.object({
  claims: z.number().optional(),
  collections: z.number().optional(),
  paid: z.number().optional(),
  bills: z.number().optional(),
  previous_balance: z.number().optional(),
  previous_drag: z.number().optional(),
  /** Además de guardar, marca el día como liquidado para ese pasador. */
  liquidate: z.boolean().optional(),
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

// ------------------------------------------------------- cuenta del grupo

/** Liquidación del grupo: el % del admin se escribe cada vez. */
export const liquidatePollaGroupSchema = z.object({
  polla_group_id: z.string().uuid(),
  date: isoDate,
  admin_percentage: z.number().min(0).max(100),
  /** Ajuste a mano (con signo) sobre lo que se le debe al admin. */
  adjustments: z.number().optional(),
  /** Lo que se le pagó al admin en esta liquidación. */
  paid: z.number().min(0).optional(),
});

// ------------------------------------------------------------------ gastos

export const newPollaOrgExpenseSchema = z.object({
  date: isoDate,
  name: z.string().trim().min(1, 'El gasto necesita un nombre').max(120),
  amount: z.number().positive('El monto tiene que ser mayor a cero'),
  polla_group_id: z.string().uuid().nullable().optional(),
  polla_organization_id: z.string().uuid().optional(),
});

export type INewPollaEditionPayload = z.infer<typeof newPollaEditionSchema>;
export type INewPollaResultPayload = z.infer<typeof newPollaResultSchema>;
export type INewPollaBetPayload = z.infer<typeof newPollaBetSchema>;
export type IUpdatePollaBetPayload = z.infer<typeof updatePollaBetSchema>;
export type IRepeatPollaBetsPayload = z.infer<typeof repeatPollaBetsSchema>;
export type ILiquidatePollaGroupPayload = z.infer<typeof liquidatePollaGroupSchema>;
export type IPollaCurrentAccountUpdatePayload = z.infer<typeof pollaCurrentAccountUpdateSchema>;
export type INewPollaOrgExpensePayload = z.infer<typeof newPollaOrgExpenseSchema>;
