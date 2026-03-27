import { z } from 'zod';
export declare const newTicketSchema: z.ZodObject<
  {
    user_id: z.ZodNullable<z.ZodString>;
    user_name: z.ZodString;
    date: z.ZodString;
    bets: z.ZodArray<
      z.ZodEffects<
        z.ZodObject<
          {
            number: z.ZodString;
            amount: z.ZodNumber;
            place: z.ZodNativeEnum<typeof import('../types/bet.type').PLACE_TYPE>;
            with: z.ZodNullable<z.ZodString>;
            position: z.ZodOptional<
              z.ZodNullable<z.ZodNativeEnum<typeof import('../types/bet.type').PLACE_TYPE>>
            >;
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
            place: import('../types/bet.type').PLACE_TYPE;
            with: string | null;
            scheduleLottery: {
              lotteries: {
                lottery_id: string;
              }[];
              schedule: {
                schedule_id: string;
              };
            }[];
            position?: import('../types/bet.type').PLACE_TYPE | null | undefined;
          },
          {
            number: string;
            amount: number;
            place: import('../types/bet.type').PLACE_TYPE;
            with: string | null;
            scheduleLottery: {
              lotteries: {
                lottery_id: string;
              }[];
              schedule: {
                schedule_id: string;
              };
            }[];
            position?: import('../types/bet.type').PLACE_TYPE | null | undefined;
          }
        >,
        {
          number: string;
          amount: number;
          place: import('../types/bet.type').PLACE_TYPE;
          with: string | null;
          scheduleLottery: {
            lotteries: {
              lottery_id: string;
            }[];
            schedule: {
              schedule_id: string;
            };
          }[];
          position?: import('../types/bet.type').PLACE_TYPE | null | undefined;
        },
        {
          number: string;
          amount: number;
          place: import('../types/bet.type').PLACE_TYPE;
          with: string | null;
          scheduleLottery: {
            lotteries: {
              lottery_id: string;
            }[];
            schedule: {
              schedule_id: string;
            };
          }[];
          position?: import('../types/bet.type').PLACE_TYPE | null | undefined;
        }
      >,
      'many'
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    date: string;
    user_id: string | null;
    bets: {
      number: string;
      amount: number;
      place: import('../types/bet.type').PLACE_TYPE;
      with: string | null;
      scheduleLottery: {
        lotteries: {
          lottery_id: string;
        }[];
        schedule: {
          schedule_id: string;
        };
      }[];
      position?: import('../types/bet.type').PLACE_TYPE | null | undefined;
    }[];
    user_name: string;
  },
  {
    date: string;
    user_id: string | null;
    bets: {
      number: string;
      amount: number;
      place: import('../types/bet.type').PLACE_TYPE;
      with: string | null;
      scheduleLottery: {
        lotteries: {
          lottery_id: string;
        }[];
        schedule: {
          schedule_id: string;
        };
      }[];
      position?: import('../types/bet.type').PLACE_TYPE | null | undefined;
    }[];
    user_name: string;
  }
>;
