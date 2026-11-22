import type { ICurrentAccountEntityFront } from '@helper/types/current_account.type';

/**
 * Los montos que imprime la hoja de liquidación de un pasador
 * (`buildUserSlipPDF`): Pase, Aciertos, Reclamos, Subtotal, Saldo, Cobre,
 * Pague, Deje, Comisión, Deja, Gastos y Debe/Cobra.
 */
const SLIP_AMOUNT_KEYS = [
  'pass',
  'successes',
  'claims',
  'subtotal',
  'previous_balance',
  'collections',
  'paid',
  'total',
  'leave',
  'cashier_commission',
  'revenue',
  'bills',
] as const satisfies readonly (keyof ICurrentAccountEntityFront)[];

/**
 * False si la hoja saldría toda en 0: ese pasador no se exporta. Sin aciertos
 * (`successes` en 0) tampoco hay premios en la tabla de la hoja.
 */
export const hasLiquidationAmounts = (
  account: Pick<ICurrentAccountEntityFront, (typeof SLIP_AMOUNT_KEYS)[number]>
) => SLIP_AMOUNT_KEYS.some((key) => Number(account[key] ?? 0) !== 0);
