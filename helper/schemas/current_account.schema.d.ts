import { z } from 'zod';
export declare const updateCurrentAccountSchema: z.ZodObject<
  {
    claims: z.ZodOptional<z.ZodNumber>;
    collections: z.ZodOptional<z.ZodNumber>;
    drag: z.ZodOptional<z.ZodNumber>;
    paid: z.ZodOptional<z.ZodNumber>;
    leave: z.ZodOptional<z.ZodNumber>;
  },
  'strip',
  z.ZodTypeAny,
  {
    paid?: number | undefined;
    claims?: number | undefined;
    collections?: number | undefined;
    drag?: number | undefined;
    leave?: number | undefined;
  },
  {
    paid?: number | undefined;
    claims?: number | undefined;
    collections?: number | undefined;
    drag?: number | undefined;
    leave?: number | undefined;
  }
>;
