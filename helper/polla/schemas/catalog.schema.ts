import { z } from 'zod';

const name = z.string().min(1, 'El nombre es obligatorio').max(120);

// --------------------------------------------------------- organizaciones

export const newPollaOrganizationSchema = z.object({ name });
export const updatePollaOrganizationSchema = z.object({ name: name.optional() });

// ---------------------------------------------------------------- grupos

export const newPollaGroupSchema = z.object({
  name,
  polla_organization_id: z.string().uuid().optional(),
});
export const updatePollaGroupSchema = z.object({ name: name.optional() });

// ------------------------------------------------------------- quinielas

export const newPollaLotterySchema = z.object({
  name,
  active: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  polla_organization_id: z.string().uuid().optional(),
});

export const updatePollaLotterySchema = z.object({
  name: name.optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ----------------------------------------------------------------- turnos

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const newPollaScheduleSchema = z.object({
  name,
  time: z.string().regex(timeRegex, 'Horario inválido (HH:mm)'),
  active: z.boolean().optional(),
  polla_organization_id: z.string().uuid().optional(),
});

export const updatePollaScheduleSchema = z.object({
  name: name.optional(),
  time: z.string().regex(timeRegex, 'Horario inválido (HH:mm)').optional(),
  active: z.boolean().optional(),
});

export type INewPollaOrganizationPayload = z.infer<typeof newPollaOrganizationSchema>;
export type INewPollaGroupPayload = z.infer<typeof newPollaGroupSchema>;
export type INewPollaLotteryPayload = z.infer<typeof newPollaLotterySchema>;
export type INewPollaSchedulePayload = z.infer<typeof newPollaScheduleSchema>;
