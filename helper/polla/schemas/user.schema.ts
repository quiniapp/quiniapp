import { z } from 'zod';
import { POLLA_USER_TYPE } from '../types/user.type';

const password = z.string().min(6, 'La contraseña debe tener al menos 6 caracteres');

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
    password,
    polla_organization_id: z.string().uuid().optional(),
    parent_polla_user_id: z.string().uuid().nullable().optional(),
    fee: z.number().min(0).max(100).nullable().optional(),
    /** La liquidación de Polla no tiene deje: la API lo fuerza a 0. */
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
    }

    // Pasadores y jugadores se buscan por número para cargarles jugadas.
    if (
      (data.user_type === POLLA_USER_TYPE.CASHIER || data.user_type === POLLA_USER_TYPE.PLAYER) &&
      (data.number === null || data.number === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['number'],
        message:
          data.user_type === POLLA_USER_TYPE.CASHIER
            ? 'El pasador necesita un número'
            : 'El jugador necesita un número',
      });
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
});

/** Blanqueo de contraseña: el usuario tiene que cambiarla al entrar. */
export const resetPollaPasswordSchema = z.object({ password });

/** Alta de una organización con su capitalista (como QuiniApp). */
export const newPollaOrganizationWithCapitalistSchema = z.object({
  organization: z.object({
    name: z.string().trim().min(1, 'El nombre de la organización es obligatorio').max(120),
  }),
  capitalist: z.object({
    name: baseUser.name,
    last_name: baseUser.last_name,
    username: z.string().trim().min(3, 'El usuario necesita al menos 3 caracteres').max(60),
    password,
    email: baseUser.email,
    phone: baseUser.phone,
  }),
});

export type INewPollaUserPayload = z.infer<typeof newPollaUserSchema>;
export type IUpdatePollaUserPayload = z.infer<typeof updatePollaUserSchema>;
export type IResetPollaPasswordPayload = z.infer<typeof resetPollaPasswordSchema>;
export type INewPollaOrganizationWithCapitalistPayload = z.infer<
  typeof newPollaOrganizationWithCapitalistSchema
>;
