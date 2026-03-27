import { z } from 'zod';
export declare const newScheduleSchema: z.ZodObject<
  {
    name: z.ZodString;
    time: z.ZodEffects<z.ZodString, string, string>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    time: string;
  },
  {
    name: string;
    time: string;
  }
>;
export declare const updateScheduleSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    time: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name?: string | undefined;
    time?: string | undefined;
  },
  {
    name?: string | undefined;
    time?: string | undefined;
  }
>;
