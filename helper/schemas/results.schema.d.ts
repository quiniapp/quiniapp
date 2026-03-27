import { z } from 'zod';
export declare const newResultsSchema: z.ZodObject<
  {
    results: z.ZodArray<z.ZodString, 'many'>;
    lottery_id: z.ZodString;
    schedule_id: z.ZodString;
    date: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    lottery_id: string;
    schedule_id: string;
    results: string[];
    date?: string | undefined;
  },
  {
    lottery_id: string;
    schedule_id: string;
    results: string[];
    date?: string | undefined;
  }
>;
export declare const editResultsSchema: z.ZodObject<
  {
    results: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>;
    lottery_id: z.ZodOptional<z.ZodString>;
    schedule_id: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    date?: string | undefined;
    lottery_id?: string | undefined;
    schedule_id?: string | undefined;
    results?: string[] | undefined;
  },
  {
    date?: string | undefined;
    lottery_id?: string | undefined;
    schedule_id?: string | undefined;
    results?: string[] | undefined;
  }
>;
export declare const getResultsSchema: z.ZodUnion<
  [
    z.ZodObject<
      {
        results_id: z.ZodString;
        date: z.ZodUndefined;
        lottery_id: z.ZodUndefined;
        schedule_id: z.ZodUndefined;
      },
      'strip',
      z.ZodTypeAny,
      {
        results_id: string;
        date?: undefined;
        lottery_id?: undefined;
        schedule_id?: undefined;
      },
      {
        results_id: string;
        date?: undefined;
        lottery_id?: undefined;
        schedule_id?: undefined;
      }
    >,
    z.ZodObject<
      {
        results_id: z.ZodUndefined;
        date: z.ZodEffects<z.ZodString, string, string>;
        lottery_id: z.ZodString;
        schedule_id: z.ZodString;
      },
      'strip',
      z.ZodTypeAny,
      {
        date: string;
        lottery_id: string;
        schedule_id: string;
        results_id?: undefined;
      },
      {
        date: string;
        lottery_id: string;
        schedule_id: string;
        results_id?: undefined;
      }
    >,
  ]
>;
