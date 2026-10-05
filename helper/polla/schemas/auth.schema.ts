import { z } from 'zod';
import { POLLA_THEME } from '../types/user.type';

export const pollaLoginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const pollaChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'La contraseña actual es obligatoria'),
    new_password: z.string().min(6, 'La contraseña nueva debe tener al menos 6 caracteres'),
    confirm_password: z.string().min(1, 'Repetí la contraseña nueva'),
  })
  .superRefine((data, ctx) => {
    if (data.new_password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm_password'],
        message: 'Las contraseñas no coinciden',
      });
    }
  });

export const updatePollaPreferencesSchema = z.object({
  theme: z.nativeEnum(POLLA_THEME),
});

export type IPollaLoginPayload = z.infer<typeof pollaLoginSchema>;
export type IPollaChangePasswordPayload = z.infer<typeof pollaChangePasswordSchema>;
export type IUpdatePollaPreferencesPayload = z.infer<typeof updatePollaPreferencesSchema>;
