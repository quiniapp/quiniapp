import { z } from 'zod';

export const newScheduleSchema = z.object({
  name: z.string().min(1),
  time: z.string().refine((val) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(val), {
    message: 'Invalid time format (expected HH:mm)',
  }),
});
export const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  time: z
    .string()
    .refine((val) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(val), {
      message: 'Invalid time format (expected HH:mm)',
    })
    .optional(),
});
