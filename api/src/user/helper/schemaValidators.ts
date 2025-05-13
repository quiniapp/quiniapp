import { CASHIER_TYPE, USER_TYPE } from '@helper/types/user.type';
import { z } from 'zod';

// Base común a todos
const baseSchema = z.object({
  number: z.number(),
  name: z.string().min(1),
  user_type: z.nativeEnum(USER_TYPE),
});

// Schema para CASHIER con cashier_type: STREET
const cashierStreetSchema = baseSchema.extend({
  user_type: z.literal(USER_TYPE.CASHIER),
  cashier_type: z.literal(CASHIER_TYPE.STREET),
  fee: z.number(),
  fee_plus: z.number(),
});

// Schema para CASHIER con cashier_type: PC
const cashierPCSchema = baseSchema.extend({
  user_type: z.literal(USER_TYPE.CASHIER),
  cashier_type: z.literal(CASHIER_TYPE.PC),
  fee: z.number(),
  fee_plus: z.number(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Schema para OWNER o ADMIN
const ownerOrAdminSchema = baseSchema.extend({
  user_type: z.union([z.literal(USER_TYPE.OWNER), z.literal(USER_TYPE.ADMIN)]),
  cashier_type: z.null().optional(),
  fee: z.null().optional(),
  fee_plus: z.null().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Unión final
export const UserSchema = z.union([cashierStreetSchema, cashierPCSchema, ownerOrAdminSchema]);
