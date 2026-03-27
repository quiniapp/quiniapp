import { z } from 'zod';
export declare const updateLotterySchema: z.ZodObject<
  {
    name: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
  },
  {
    name: string;
  }
>;
export declare const newLotterySchema: z.ZodObject<
  {
    name: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
  },
  {
    name: string;
  }
>;
