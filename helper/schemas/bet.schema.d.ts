import { z } from 'zod';
import { PLACE_TYPE } from '../types/bet.type';
export declare const BetTableSchema: z.ZodEffects<
  z.ZodObject<
    {
      number: z.ZodString;
      amount: z.ZodNumber;
      place: z.ZodNativeEnum<typeof PLACE_TYPE>;
      with: z.ZodNullable<z.ZodString>;
      position: z.ZodOptional<z.ZodNullable<z.ZodNativeEnum<typeof PLACE_TYPE>>>;
      scheduleLottery: z.ZodArray<
        z.ZodObject<
          {
            schedule: z.ZodObject<
              {
                schedule_id: z.ZodString;
              },
              'strip',
              z.ZodTypeAny,
              {
                schedule_id: string;
              },
              {
                schedule_id: string;
              }
            >;
            lotteries: z.ZodArray<
              z.ZodObject<
                {
                  lottery_id: z.ZodString;
                },
                'strip',
                z.ZodTypeAny,
                {
                  lottery_id: string;
                },
                {
                  lottery_id: string;
                }
              >,
              'many'
            >;
          },
          'strip',
          z.ZodTypeAny,
          {
            lotteries: {
              lottery_id: string;
            }[];
            schedule: {
              schedule_id: string;
            };
          },
          {
            lotteries: {
              lottery_id: string;
            }[];
            schedule: {
              schedule_id: string;
            };
          }
        >,
        'many'
      >;
    },
    'strip',
    z.ZodTypeAny,
    {
      number: string;
      amount: number;
      place: PLACE_TYPE;
      with: string | null;
      scheduleLottery: {
        lotteries: {
          lottery_id: string;
        }[];
        schedule: {
          schedule_id: string;
        };
      }[];
      position?: PLACE_TYPE | null | undefined;
    },
    {
      number: string;
      amount: number;
      place: PLACE_TYPE;
      with: string | null;
      scheduleLottery: {
        lotteries: {
          lottery_id: string;
        }[];
        schedule: {
          schedule_id: string;
        };
      }[];
      position?: PLACE_TYPE | null | undefined;
    }
  >,
  {
    number: string;
    amount: number;
    place: PLACE_TYPE;
    with: string | null;
    scheduleLottery: {
      lotteries: {
        lottery_id: string;
      }[];
      schedule: {
        schedule_id: string;
      };
    }[];
    position?: PLACE_TYPE | null | undefined;
  },
  {
    number: string;
    amount: number;
    place: PLACE_TYPE;
    with: string | null;
    scheduleLottery: {
      lotteries: {
        lottery_id: string;
      }[];
      schedule: {
        schedule_id: string;
      };
    }[];
    position?: PLACE_TYPE | null | undefined;
  }
>;
