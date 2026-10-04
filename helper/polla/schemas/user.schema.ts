import { z } from 'zod';
import { POLLA_USER_TYPE } from '../types/user.type';
import { POLLA_CREDIT_MOVEMENT_TYPE as CREDIT_TYPE } from '../types/game.type';

const baseUser = {
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  last_name: z.string().max(120).nullable().optional(),
  phone: z.number().int().positive().nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional(),
  number: z.number().int().positive().nullable().optional(),
  username: z.string().min(3, 'Mínimo 3 caracteres').max(60).nullable().optional(),
  polla_group_id: z.string().uuid().nullable().optional(),
  disabled: z.boolean().optional(),
};

export const newPollaUserSchema = z
  .object({
    ...baseUser,
    user_type: z.nativeEnum(POLLA_USER_TYPE),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    polla_organization_id: z.string().uuid().optional(),
    parent_polla_user_id: z.string().uuid().nullable().optional(),
    fee: z.number().min(0).max(100).nullable().optional(),
    fee_plus: z.number().min(0).max(100).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.user_type === POLLA_USER_TYPE.CASHIER) {
      if (data.fee === null || data.fee === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fee'],
          message: 'El pasador necesita un porcentaje de comisión',
        });
      }
      if (data.fee_plus === null || data.fee_plus === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fee_plus'],
          message: 'El pasador necesita un porcentaje de recargo',
        });
      }
      if (data.number === null || data.number === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['number'],
          message: 'El pasador necesita un número',
        });
      }
    }

    if (data.user_type === POLLA_USER_TYPE.PLAYER && !data.parent_polla_user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent_polla_user_id'],
        message: 'El jugador tiene que colgar de un pasador',
      });
    }

    if (data.user_type !== POLLA_USER_TYPE.PLAYER && data.parent_polla_user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent_polla_user_id'],
        message: 'Solo los jugadores cuelgan de un pasador',
      });
    }
  });

export const updatePollaUserSchema = z.object({
  ...baseUser,
  parent_polla_user_id: z.string().uuid().nullable().optional(),
  fee: z.number().min(0).max(100).nullable().optional(),
  fee_plus: z.number().min(0).max(100).nullable().optional(),
  password: z.string().min(6).optional(),
});

export const pollaCreditMovementSchema = z
  .object({
    amount: z.number().refine((v) => v !== 0, 'El monto no puede ser cero'),
    type: z.nativeEnum(CREDIT_TYPE),
    reason: z.string().max(200).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === CREDIT_TYPE.BET || data.type === CREDIT_TYPE.BET_REFUND) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'Los movimientos por jugada los genera el sistema',
      });
    }
    if (data.type === CREDIT_TYPE.LOAD && data.amount < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Una carga tiene que ser positiva',
      });
    }
    if (data.type === CREDIT_TYPE.WITHDRAW && data.amount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Un retiro tiene que ser negativo',
      });
    }
  });

export type INewPollaUserPayload = z.infer<typeof newPollaUserSchema>;
export type IUpdatePollaUserPayload = z.infer<typeof updatePollaUserSchema>;
export type IPollaCreditMovementPayload = z.infer<typeof pollaCreditMovementSchema>;
