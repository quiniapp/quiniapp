import { CASHIER_TYPE, USER_TYPE } from '../types/user.type';
import { z } from 'zod';

// Base común a todos
const baseSchema = z.object({
  number: z.number(),
  name: z.string().min(1),
  user_type: z.nativeEnum(USER_TYPE),
});

// Schema para CASHIER con cashier_type: STREET
const cashierStreetSchema = z.object({
  number: z.number(),
  name: z.string().min(1),
  user_type: z.literal(USER_TYPE.CASHIER),
  cashier_type: z.literal(CASHIER_TYPE.STREET),
  fee: z.number(),
  fee_plus: z.number().optional(),
  username: z.undefined(),
  password: z.undefined(),
});


// Schema para CASHIER con cashier_type: PC
const cashierPCSchema = z.object({
  number: z.number(),
  name: z.string().min(1),
  user_type: z.literal(USER_TYPE.CASHIER),
  cashier_type: z.literal(CASHIER_TYPE.PC),
  fee: z.number(),
  fee_plus: z.number().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});


// Schema para OWNER o ADMIN
const adminSchema = z.object({
  number: z.number(),
  name: z.string().min(1),
  user_type: z.literal(USER_TYPE.ADMIN),
  cashier_type: z.null().optional(),
  fee: z.null().optional(),
  fee_plus: z.null().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});


export const UserSchema = z.union([
  adminSchema,
  cashierPCSchema,
  cashierStreetSchema,
]);



const updateBaseSchema = z.object({
  name: z.string().min(1).optional(),
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
