import { IPollaGroupEditionAccountEntity } from '@helper/polla/types/game.type';
import { groupSplit } from '@/lib/editionAccount';

/**
 * Hoja de liquidación de un grupo en una edición: los renglones que se
 * imprimen (A4, y la imagen más adelante). Funciones puras: salen siempre de
 * la liquidación guardada, nunca de la preview del momento.
 */

export type GroupLiquidationAccount = Pick<
  IPollaGroupEditionAccountEntity,
  | 'polla_group_id'
  | 'group_name'
  | 'cashiers_subtotal'
  | 'expenses'
  | 'base'
  | 'admin_percentage'
  | 'admin_commission'
  | 'edited_at'
>;

const toNumber = (n: number | string | null | undefined) =>
  Number.isFinite(Number(n)) ? Number(n) : 0;

/** `$1.234` (sin decimales); un negativo lleva el signo antes del `$`. */
const money = (n: number | string | null | undefined) => {
  const value = Math.round(toNumber(n));
  const text = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.abs(value));
  return `${value < 0 ? '-' : ''}$${text}`;
};

/** `Grupo N - Nombre`, o `Nombre` si el grupo ya no tiene número. */
export const groupLiquidationLabel = (group: { number?: number; name: string }) =>
  group.number === undefined ? group.name : `Grupo ${group.number} - ${group.name}`;

/**
 * Renglones de la hoja: lo que dejaron los pasadores, los gastos (en negativo),
 * el total, el % del admin y lo que va al admin y al capitalista.
 */
export const groupLiquidationRows = (
  account: GroupLiquidationAccount
): { label: string; value: string }[] => {
  const split = groupSplit(account.base, account.admin_commission);
  return [
    { label: 'Deja pasadores', value: money(account.cashiers_subtotal) },
    // Sin gastos dice "$0", nunca "-$0".
    { label: 'Gastos del grupo', value: money(-Math.abs(toNumber(account.expenses))) },
    { label: 'Total', value: money(account.base) },
    { label: '% admin', value: `${toNumber(account.admin_percentage)}%` },
    { label: 'Total admin', value: money(split.admin) },
    { label: 'Total capitalista', value: money(split.capitalist) },
  ];
};
