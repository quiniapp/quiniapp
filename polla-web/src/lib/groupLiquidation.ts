import {
  IPollaGroupEditionAccountEntity,
  IPollaGroupEditionAccountPreview,
} from '@helper/polla/types/game.type';
import { groupCommission, groupSplit, owedWord, parseAmount } from '@/lib/editionAccount';
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
  | 'collections'
>;

const toNumber = (n: number | string | null | undefined) =>
  Number.isFinite(Number(n)) ? Number(n) : 0;

/** `$1.234` (sin decimales); un negativo lleva el signo antes del `$`. */
export const money = (n: number | string | null | undefined) => {
  const value = Math.round(toNumber(n));
  const text = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.abs(value));
  return `${value < 0 ? '-' : ''}$${text}`;
};

const cents = (n: number | string | null | undefined) => Math.round(toNumber(n) * 100);

type GroupOwedAccount = Pick<GroupLiquidationAccount, 'base' | 'admin_commission' | 'collections'>;

/**
 * Debe del grupo: (total - comisión del admin) - cobros, sumado en centavos.
 * `added` suma lo escrito y todavía no guardado. Negativo = le deben al grupo
 * ("Cobra"). Los grupos no tienen pagos: la API guarda siempre 0.
 */
export const groupOwed = (
  account: GroupOwedAccount,
  added: { collection: number } = { collection: 0 }
): number =>
  (cents(account.base) -
    cents(account.admin_commission) -
    (cents(account.collections) + cents(added.collection))) /
  100;

/**
 * Pagado: la cuenta está liquidada, el Debe es 0 y hay algo en ella
 * (capitalista o cobros distintos de 0). Un Debe negativo nunca es Pagado.
 */
export const groupPaid = (account: GroupOwedAccount): boolean =>
  cents(groupOwed(account)) === 0 &&
  (cents(account.base) - cents(account.admin_commission) !== 0 || cents(account.collections) !== 0);

/** `'PAGADO'` si la cuenta del grupo está saldada; si no, `null`. */
export const groupLiquidationPaidMark = (account: GroupOwedAccount): 'PAGADO' | null =>
  groupPaid(account) ? 'PAGADO' : null;

/**
 * Estado de la cuenta liquidada: `Pagado`, `Pendiente` (con Debe distinto de
 * 0, también si es negativo: "Cobra") o `null` si no hay nada que saldar
 * (capitalista $0 y sin movimientos).
 */
export const groupPaymentStatus = (account: GroupOwedAccount): 'Pagado' | 'Pendiente' | null => {
  if (groupPaid(account)) return 'Pagado';
  return cents(groupOwed(account)) !== 0 ? 'Pendiente' : null;
};

/** El cobro de un grupo que se suma al liquidar. */
export interface GroupMovementAmounts {
  collection: number;
}

export type GroupMovementKey = keyof GroupMovementAmounts;

/** Lo escrito en Cobros de un grupo en "Grupos a liquidar". */
export type GroupMovementInputs = Record<GroupMovementKey, string>;

const NO_GROUP_MOVEMENTS: GroupMovementAmounts = { collection: 0 };

/**
 * Lee lo escrito en Cobros: vacío vale 0 y acepta coma decimal. Un negativo o
 * algo que no es un número queda en `invalid` (y vale 0).
 */
export const readGroupMovementInputs = (
  raw: Partial<GroupMovementInputs> | undefined
): { values: GroupMovementAmounts; invalid: Set<GroupMovementKey> } => {
  const values = { ...NO_GROUP_MOVEMENTS };
  const invalid = new Set<GroupMovementKey>();
  for (const key of ['collection'] as const) {
    const text = raw?.[key] ?? '';
    if (text.trim() === '') continue;
    const value = parseAmount(text);
    if (value === null || value < 0) invalid.add(key);
    else values[key] = value;
  }
  return { values, invalid };
};

/** Lo que se manda al liquidar: el cobro, solo si es mayor a 0. */
export const groupMovementPayload = (
  values: GroupMovementAmounts
): Partial<GroupMovementAmounts> =>
  values.collection > 0 ? { collection: values.collection } : {};

/**
 * Debe de la fila de "Grupos a liquidar" con lo escrito: el de la liquidación
 * guardada; sin liquidación, la parte del capitalista con el % del admin del
 * grupo. `null` si no tiene % configurado (se elige al liquidar).
 */
export const groupRowOwed = (
  preview: Pick<IPollaGroupEditionAccountPreview, 'base'> & {
    account: GroupOwedAccount | null;
  },
  adminPercentage: number | null,
  added: GroupMovementAmounts
): number | null => {
  if (preview.account) return groupOwed(preview.account, added);
  if (adminPercentage === null) return null;
  return groupOwedAfterLiquidation(
    null,
    {
      total: Number(preview.base),
      commission: groupCommission(Number(preview.base), adminPercentage),
    },
    added
  );
};

/**
 * Cómo queda el Debe al liquidar hoy: el total y la comisión que se van a
 * guardar, los cobros que ya tenía el grupo y lo escrito.
 */
export const groupOwedAfterLiquidation = (
  previous: Pick<GroupOwedAccount, 'collections'> | null,
  liquidation: { total: number; commission: number },
  added: GroupMovementAmounts
): number =>
  groupOwed(
    {
      base: liquidation.total,
      admin_commission: liquidation.commission,
      collections: previous?.collections ?? 0,
    },
    added
  );

export interface GroupLiquidationSheet {
  account: GroupLiquidationAccount;
  group: { number?: number; name: string };
  orgName: string;
  editionTitle: string;
  /** `YYYY-MM-DD`: la de la liquidación más nueva de las que se exportan. */
  date: string;
  /** Edición especial: los archivos llevan `polla_plus_`, como el ZIP. */
  special?: boolean;
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
  const owed = groupOwed(account);
  return [
    { label: 'Deja pasadores', value: money(account.cashiers_subtotal) },
    // Sin gastos dice "$0", nunca "-$0".
    { label: 'Gastos del grupo', value: money(-Math.abs(toNumber(account.expenses))) },
    { label: 'Total', value: money(account.base) },
    { label: '% admin', value: `${toNumber(account.admin_percentage)}%` },
    { label: 'Total admin', value: money(split.admin) },
    { label: 'Total capitalista', value: money(split.capitalist) },
    { label: 'Cobros', value: money(account.collections) },
    { label: owedWord(owed), value: money(Math.abs(owed)) },
  ];
};

/** Suma de las liquidaciones de los grupos de una edición (la fila "Total general"). */
export interface GroupLiquidationTotals {
  cashiersSubtotal: number;
  expenses: number;
  total: number;
  admin: number;
  capitalist: number;
  collections: number;
  /** Debe neto: suma de todos los Debe (los negativos restan). */
  owed: number;
  /** Falta cobrar: suma solo de los Debe positivos. */
  missing: number;
}

/**
 * Suma, en centavos, lo que dejaron los pasadores, los gastos, el total y lo
 * que va al admin y al capitalista de cada liquidación guardada (el mismo
 * cálculo que `groupSplit` en cada fila: capitalista = total - comisión).
 */
export const groupLiquidationTotals = (
  accounts: Pick<
    GroupLiquidationAccount,
    'cashiers_subtotal' | 'expenses' | 'base' | 'admin_commission' | 'collections'
  >[]
): GroupLiquidationTotals => {
  const sum = accounts.reduce(
    (acc, account) => {
      const owed = Math.round(groupOwed(account) * 100);
      return {
        cashiersSubtotal: acc.cashiersSubtotal + cents(account.cashiers_subtotal),
        expenses: acc.expenses + cents(account.expenses),
        total: acc.total + cents(account.base),
        admin: acc.admin + cents(account.admin_commission),
        capitalist: acc.capitalist + cents(account.base) - cents(account.admin_commission),
        collections: acc.collections + cents(account.collections),
        owed: acc.owed + owed,
        missing: acc.missing + Math.max(owed, 0),
      };
    },
    {
      cashiersSubtotal: 0,
      expenses: 0,
      total: 0,
      admin: 0,
      capitalist: 0,
      collections: 0,
      owed: 0,
      missing: 0,
    }
  );
  return {
    cashiersSubtotal: sum.cashiersSubtotal / 100,
    expenses: sum.expenses / 100,
    total: sum.total / 100,
    admin: sum.admin / 100,
    capitalist: sum.capitalist / 100,
    collections: sum.collections / 100,
    owed: sum.owed / 100,
    missing: sum.missing / 100,
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
    special?: boolean;
  }
): GroupLiquidationSheet[] => {
  const date = groupReportDate(accounts) ?? ctx.today;
  return accounts.map((account) => ({
    account,
    group: { number: ctx.groupNumberOf(account.polla_group_id), name: account.group_name },
    orgName: ctx.orgName,
    editionTitle: ctx.editionTitle,
    date,
    special: ctx.special,
  }));
};
