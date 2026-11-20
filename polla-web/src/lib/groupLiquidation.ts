import { IPollaGroupEditionAccountEntity } from '@helper/polla/types/game.type';
import { groupSplit } from '@/lib/editionAccount';
import { groupReportDate } from '@/lib/groupDailyReport';

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
export const money = (n: number | string | null | undefined) => {
  const value = Math.round(toNumber(n));
  const text = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.abs(value));
  return `${value < 0 ? '-' : ''}$${text}`;
};

export interface GroupLiquidationSheet {
  account: GroupLiquidationAccount;
  group: { number?: number; name: string };
  orgName: string;
  editionTitle: string;
  /** `YYYY-MM-DD`: la de la liquidación más nueva de las que se exportan. */
  date: string;
}

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

/** Suma de las liquidaciones de los grupos de una edición (la fila "Total general"). */
export interface GroupLiquidationTotals {
  cashiersSubtotal: number;
  expenses: number;
  total: number;
  admin: number;
  capitalist: number;
}

const cents = (n: number | string | null | undefined) => Math.round(toNumber(n) * 100);

/**
 * Suma, en centavos, lo que dejaron los pasadores, los gastos, el total y lo
 * que va al admin y al capitalista de cada liquidación guardada (el mismo
 * cálculo que `groupSplit` en cada fila: capitalista = total - comisión).
 */
export const groupLiquidationTotals = (
  accounts: Pick<
    GroupLiquidationAccount,
    'cashiers_subtotal' | 'expenses' | 'base' | 'admin_commission'
  >[]
): GroupLiquidationTotals => {
  const sum = accounts.reduce(
    (acc, account) => ({
      cashiersSubtotal: acc.cashiersSubtotal + cents(account.cashiers_subtotal),
      expenses: acc.expenses + cents(account.expenses),
      total: acc.total + cents(account.base),
      admin: acc.admin + cents(account.admin_commission),
      capitalist: acc.capitalist + cents(account.base) - cents(account.admin_commission),
    }),
    { cashiersSubtotal: 0, expenses: 0, total: 0, admin: 0, capitalist: 0 }
  );
  return {
    cashiersSubtotal: sum.cashiersSubtotal / 100,
    expenses: sum.expenses / 100,
    total: sum.total / 100,
    admin: sum.admin / 100,
    capitalist: sum.capitalist / 100,
  };
};

/**
 * Las hojas de las liquidaciones guardadas, una por grupo. Una sola fecha para
 * todas: la de la liquidación más nueva (`today` si no hay ninguna).
 */
export const groupLiquidationSheets = (
  accounts: (GroupLiquidationAccount & { polla_group_id: string })[],
  ctx: {
    groupNumberOf: (groupId: string) => number | undefined;
    orgName: string;
    editionTitle: string;
    today: string;
  }
): GroupLiquidationSheet[] => {
  const date = groupReportDate(accounts) ?? ctx.today;
  return accounts.map((account) => ({
    account,
    group: { number: ctx.groupNumberOf(account.polla_group_id), name: account.group_name },
    orgName: ctx.orgName,
    editionTitle: ctx.editionTitle,
    date,
  }));
};
