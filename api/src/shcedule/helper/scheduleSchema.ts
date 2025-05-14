import { z } from 'zod';

export const ScheduleSchema = z.object({
  name: z.string().min(1),
  time: z.string().time(),
});
export const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  time: z.string().time().optional(),
});
