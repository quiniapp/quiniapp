import { CASHIER_TYPE, USER_TYPE } from '../types/user.type';
import { z } from 'zod';

// Base común a todos - number ahora es nullable
const baseSchema = z.object({
  number: z.number().nullable(),
  name: z.string().min(1),
  user_type: z.nativeEnum(USER_TYPE),
});

// Schema para CASHIER con cashier_type: STREET
const cashierStreetSchema = baseSchema
  .extend({
    user_type: z.literal(USER_TYPE.CASHIER),
    cashier_type: z.literal(CASHIER_TYPE.STREET),
    fee: z.number(),
    fee_plus: z.number(),
  })
  .refine((data) => data.number !== null, {
    message: 'Number is required for CASHIER users',
    path: ['number'],
  });

// Schema para CASHIER con cashier_type: PC
const cashierPCSchema = baseSchema
  .extend({
    user_type: z.literal(USER_TYPE.CASHIER),
    cashier_type: z.literal(CASHIER_TYPE.PC),
    fee: z.number(),
    fee_plus: z.number(),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => data.number !== null, {
    message: 'Number is required for CASHIER users',
    path: ['number'],
  });

// Schema para ADMIN (requiere number)
const adminSchema = baseSchema
  .extend({
    user_type: z.literal(USER_TYPE.ADMIN),
    cashier_type: z.null().optional(),
    fee: z.null().optional(),
    fee_plus: z.null().optional(),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => data.number !== null, {
    message: 'Number is required for ADMIN users',
    path: ['number'],
  });

// Schema para OWNER (number opcional)
const ownerSchema = baseSchema.extend({
  user_type: z.literal(USER_TYPE.OWNER),
  cashier_type: z.null().optional(),
  fee: z.null().optional(),
  fee_plus: z.null().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Schema para SUPERADMIN (number opcional)
const superAdminSchema = baseSchema.extend({
  user_type: z.literal(USER_TYPE.SUPERADMIN),
  cashier_type: z.null().optional(),
  fee: z.null().optional(),
  fee_plus: z.null().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Unión final
export const UserSchema = z.union([
  cashierStreetSchema,
  cashierPCSchema,
  adminSchema,
  ownerSchema,
  superAdminSchema,
]);

const updateBaseSchema = z.object({
  name: z.string().min(1).optional(),
  number: z.number().nullable().optional(),
});

// Schema para CASHIER con cashier_type: STREET
const updateCashierStreetSchema = updateBaseSchema.extend({
  fee: z.number().optional(),
  fee_plus: z.number().optional(),
});

// Schema para CASHIER con cashier_type: PC
const updateCashierPCSchema = updateBaseSchema.extend({
  fee: z.number().optional(),
  fee_plus: z.number().optional(),
  password: z.string().min(1, 'Password is required').optional(),
});

// Schema para OWNER o ADMIN
const updateOwnerOrAdminSchema = updateBaseSchema.extend({
  cashier_type: z.null().optional(),
  fee: z.null().optional(),
  fee_plus: z.null().optional(),
  password: z.string().min(1, 'Password is required').optional(),
});

// Unión final
export const updateUserSchema = z.union([
  updateCashierStreetSchema,
  updateCashierPCSchema,
  updateOwnerOrAdminSchema,
]);
