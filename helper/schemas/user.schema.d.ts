import { CASHIER_TYPE, USER_TYPE } from '../types/user.type';
import { z } from 'zod';
export declare const UserSchema: z.ZodUnion<
  [
    z.ZodEffects<
      z.ZodObject<
        {
          number: z.ZodNullable<z.ZodNumber>;
          name: z.ZodString;
        } & {
          user_type: z.ZodLiteral<USER_TYPE.CASHIER>;
          cashier_type: z.ZodLiteral<CASHIER_TYPE.STREET>;
          fee: z.ZodNumber;
          fee_plus: z.ZodNumber;
        },
        'strip',
        z.ZodTypeAny,
        {
          number: number | null;
          name: string;
          user_type: USER_TYPE.CASHIER;
          cashier_type: CASHIER_TYPE.STREET;
          fee: number;
          fee_plus: number;
        },
        {
          number: number | null;
          name: string;
          user_type: USER_TYPE.CASHIER;
          cashier_type: CASHIER_TYPE.STREET;
          fee: number;
          fee_plus: number;
        }
      >,
      {
        number: number | null;
        name: string;
        user_type: USER_TYPE.CASHIER;
        cashier_type: CASHIER_TYPE.STREET;
        fee: number;
        fee_plus: number;
      },
      {
        number: number | null;
        name: string;
        user_type: USER_TYPE.CASHIER;
        cashier_type: CASHIER_TYPE.STREET;
        fee: number;
        fee_plus: number;
      }
    >,
    z.ZodEffects<
      z.ZodObject<
        {
          number: z.ZodNullable<z.ZodNumber>;
          name: z.ZodString;
        } & {
          user_type: z.ZodLiteral<USER_TYPE.CASHIER>;
          cashier_type: z.ZodLiteral<CASHIER_TYPE.PC>;
          fee: z.ZodNumber;
          fee_plus: z.ZodNumber;
          username: z.ZodString;
          password: z.ZodString;
        },
        'strip',
        z.ZodTypeAny,
        {
          number: number | null;
          name: string;
          username: string;
          user_type: USER_TYPE.CASHIER;
          password: string;
          cashier_type: CASHIER_TYPE.PC;
          fee: number;
          fee_plus: number;
        },
        {
          number: number | null;
          name: string;
          username: string;
          user_type: USER_TYPE.CASHIER;
          password: string;
          cashier_type: CASHIER_TYPE.PC;
          fee: number;
          fee_plus: number;
        }
      >,
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.CASHIER;
        password: string;
        cashier_type: CASHIER_TYPE.PC;
        fee: number;
        fee_plus: number;
      },
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.CASHIER;
        password: string;
        cashier_type: CASHIER_TYPE.PC;
        fee: number;
        fee_plus: number;
      }
    >,
    z.ZodEffects<
      z.ZodObject<
        {
          number: z.ZodNullable<z.ZodNumber>;
          name: z.ZodString;
        } & {
          user_type: z.ZodLiteral<USER_TYPE.ADMIN>;
          cashier_type: z.ZodOptional<z.ZodNull>;
          fee: z.ZodOptional<z.ZodNull>;
          fee_plus: z.ZodOptional<z.ZodNull>;
          username: z.ZodString;
          password: z.ZodString;
        },
        'strip',
        z.ZodTypeAny,
        {
          number: number | null;
          name: string;
          username: string;
          user_type: USER_TYPE.ADMIN;
          password: string;
          cashier_type?: null | undefined;
          fee?: null | undefined;
          fee_plus?: null | undefined;
        },
        {
          number: number | null;
          name: string;
          username: string;
          user_type: USER_TYPE.ADMIN;
          password: string;
          cashier_type?: null | undefined;
          fee?: null | undefined;
          fee_plus?: null | undefined;
        }
      >,
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.ADMIN;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      },
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.ADMIN;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      }
    >,
    z.ZodObject<
      {
        number: z.ZodNullable<z.ZodNumber>;
        name: z.ZodString;
      } & {
        user_type: z.ZodLiteral<USER_TYPE.OWNER>;
        cashier_type: z.ZodOptional<z.ZodNull>;
        fee: z.ZodOptional<z.ZodNull>;
        fee_plus: z.ZodOptional<z.ZodNull>;
        username: z.ZodString;
        password: z.ZodString;
      },
      'strip',
      z.ZodTypeAny,
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.OWNER;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      },
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.OWNER;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      }
    >,
    z.ZodObject<
      {
        number: z.ZodNullable<z.ZodNumber>;
        name: z.ZodString;
      } & {
        user_type: z.ZodLiteral<USER_TYPE.CAPITALIST>;
        cashier_type: z.ZodOptional<z.ZodNull>;
        fee: z.ZodOptional<z.ZodNull>;
        fee_plus: z.ZodOptional<z.ZodNull>;
        username: z.ZodString;
        password: z.ZodString;
      },
      'strip',
      z.ZodTypeAny,
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.CAPITALIST;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      },
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.CAPITALIST;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      }
    >,
    z.ZodObject<
      {
        number: z.ZodNullable<z.ZodNumber>;
        name: z.ZodString;
      } & {
        user_type: z.ZodLiteral<USER_TYPE.SUPERADMIN>;
        cashier_type: z.ZodOptional<z.ZodNull>;
        fee: z.ZodOptional<z.ZodNull>;
        fee_plus: z.ZodOptional<z.ZodNull>;
        username: z.ZodString;
        password: z.ZodString;
      },
      'strip',
      z.ZodTypeAny,
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.SUPERADMIN;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      },
      {
        number: number | null;
        name: string;
        username: string;
        user_type: USER_TYPE.SUPERADMIN;
        password: string;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      }
    >,
  ]
>;
export declare const updateUserSchema: z.ZodUnion<
  [
    z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        number: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
      } & {
        fee: z.ZodOptional<z.ZodNumber>;
        fee_plus: z.ZodOptional<z.ZodNumber>;
      },
      'strip',
      z.ZodTypeAny,
      {
        number?: number | null | undefined;
        name?: string | undefined;
        fee?: number | undefined;
        fee_plus?: number | undefined;
      },
      {
        number?: number | null | undefined;
        name?: string | undefined;
        fee?: number | undefined;
        fee_plus?: number | undefined;
      }
    >,
    z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        number: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
      } & {
        fee: z.ZodOptional<z.ZodNumber>;
        fee_plus: z.ZodOptional<z.ZodNumber>;
        password: z.ZodOptional<z.ZodString>;
      },
      'strip',
      z.ZodTypeAny,
      {
        number?: number | null | undefined;
        name?: string | undefined;
        password?: string | undefined;
        fee?: number | undefined;
        fee_plus?: number | undefined;
      },
      {
        number?: number | null | undefined;
        name?: string | undefined;
        password?: string | undefined;
        fee?: number | undefined;
        fee_plus?: number | undefined;
      }
    >,
    z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        number: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
      } & {
        cashier_type: z.ZodOptional<z.ZodNull>;
        fee: z.ZodOptional<z.ZodNull>;
        fee_plus: z.ZodOptional<z.ZodNull>;
        password: z.ZodOptional<z.ZodString>;
      },
      'strip',
      z.ZodTypeAny,
      {
        number?: number | null | undefined;
        name?: string | undefined;
        password?: string | undefined;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      },
      {
        number?: number | null | undefined;
        name?: string | undefined;
        password?: string | undefined;
        cashier_type?: null | undefined;
        fee?: null | undefined;
        fee_plus?: null | undefined;
      }
    >,
  ]
>;
