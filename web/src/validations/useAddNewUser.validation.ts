import { z } from 'zod';

export const addNewUserSchema = z.object({
  pinNumber: z
    .string()
    .min(4, { message: 'El número de pasador debe tener al menos 4 caracteres.' }),
  pinType: z.string().optional(),
  group: z.string().optional(),
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  lastName: z.string().min(2, { message: 'El apellido debe tener al menos 2 caracteres.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: 'Ingrese un correo electrónico válido.' }).optional(),
  user: z.string().min(2, { message: 'El nombre de usuario debe tener al menos 2 caracteres.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  commission: z
    .preprocess((val) => Number(val), z.number())
    .optional()
    .refine((value) => value === undefined || value >= 0, {
      message: 'La comisión no puede ser negativa.',
    }),
  spread: z
    .number()
    .optional()
    .refine((value) => value === undefined || value >= 0, {
      message: 'El deje (spread) no puede ser negativo.',
    }),
});
