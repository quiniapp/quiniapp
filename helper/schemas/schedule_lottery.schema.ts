import { SCHEDULE_DAY } from '../types/schedule-lottery.type';
import { z } from 'zod';

// partialRecord: en zod 4, `z.record` con un enum de claves exige todos los días.
export const scheduleLotteriesSchema = z.partialRecord(
  z.enum(SCHEDULE_DAY),
  // Por cada día, un objeto { [schedule_id: string]: string[] }
  z.record(z.string(), z.array(z.string()))
);
