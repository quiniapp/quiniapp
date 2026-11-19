import type { AccountPeriodView } from '@/lib/accountPeriod';

/**
 * Los montos que imprime la hoja de un pasador (los acumulados de su período).
 * Sin premios: no van en la cuenta corriente (R18), están en Premios.
 */
export const liquidationSlipAmounts = (account: AccountPeriodView) => ({
  bets_pass: Number(account.bets_pass ?? 0),
  deleted_pass: Number(account.deleted_pass ?? 0),
  pass: Number(account.pass ?? 0),
  claims: Number(account.claims ?? 0),
  subtotal: Number(account.subtotal ?? 0),
  previous_balance: Number(account.previous_balance ?? 0),
  collections: Number(account.collections ?? 0),
  paid: Number(account.paid ?? 0),
  cashier_commission: Number(account.cashier_commission ?? 0),
  bills: Number(account.bills ?? 0),
  revenue: Number(account.revenue ?? 0),
  total: Number(account.total ?? 0),
});

/** Lo que se mira para decidir si un pasador tuvo movimiento en el período. */
const MOVEMENT_KEYS = [
  'bets_pass',
  'deleted_pass',
  'pass',
  'previous_balance',
  'collections',
  'paid',
  // Un reclamo sin pase (o un premio de un período ya liquidado) deja el
  // total distinto de 0: hay plata que liquidar.
  'total',
] as const;

/**
 * Con movimiento: algo en el pase, las borradas, el saldo anterior, los cobros,
 * los pagos o el total. Los que no tienen nada vienen sin tildar al exportar.
 */
export const hasAccountMovement = (account: AccountPeriodView) => {
  const amounts = liquidationSlipAmounts(account);
  return MOVEMENT_KEYS.some((key) => amounts[key] !== 0);
};
