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
 * Con movimiento: algún monto de la hoja distinto de 0. Los que tienen la hoja
 * toda en 0 vienen sin tildar al exportar (se pueden sumar a mano). Sin
 * aciertos (`successes` en 0) tampoco hay premios en la tabla de la hoja.
 */
export const hasAccountMovement = (
  account: Pick<ICurrentAccountEntityFront, (typeof SLIP_AMOUNT_KEYS)[number]>
) => SLIP_AMOUNT_KEYS.some((key) => Number(account[key] ?? 0) !== 0);
