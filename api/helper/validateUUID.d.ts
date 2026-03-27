import { z } from 'zod';
export declare const validateUUID: z.ZodObject<
  {
    user_id: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    user_id: string;
  },
  {
    user_id: string;
  }
>;
