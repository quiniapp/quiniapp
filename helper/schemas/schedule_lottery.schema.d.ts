import { SCHEDULE_DAY } from '../types/schedule-lottery.type';
import { z } from 'zod';
export declare const scheduleLotteriesSchema: z.ZodRecord<
  z.ZodNativeEnum<typeof SCHEDULE_DAY>,
  z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, 'many'>>
>;
