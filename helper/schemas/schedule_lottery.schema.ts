import { SCHEDULE_DAY } from '../types/schedule-lottery.type';
import { z } from 'zod';

export const scheduleLotteriesSchema = z.record(
  z.nativeEnum(SCHEDULE_DAY),
  // Por cada día, un objeto { [schedule_id: string]: string[] }
  z.record(z.string(), z.array(z.string()))
);
