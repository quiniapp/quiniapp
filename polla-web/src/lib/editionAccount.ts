import {
  IPollaEditionAccountAmounts,
  IPollaEditionAccountListItem,
  IPollaEditionAccountRow,
  IPollaEditionEntityFront,
  IPollaGroupEditionAccountPreview,
} from '@helper/polla/types/game.type';
import { AccountPeriodView } from '@/lib/accountPeriod';

/**
 * Cuenta por edición: helpers puros. La fila de edición se mapea a la forma de
 * la fila de período para reusar los PDF y tickets actuales.
 */

const MOVEMENT_KEYS = ['bets_pass', 'deleted_pass', 'claims', 'collections', 'paid'] as const;

/** Con movimiento: algún monto de la edición distinto de 0 (un ticket de cortesía no cuenta). */
export const hasEditionMovement = (row: IPollaEditionAccountAmounts) =>
  MOVEMENT_KEYS.some((key) => Number(row[key] ?? 0) !== 0);

/** La fila de un pasador en una edición, con la forma de la vista por período. */
export const editionAccountView = (
  row: IPollaEditionAccountRow,
  edition: Pick<IPollaEditionEntityFront, 'polla_edition_id' | 'start_date' | 'end_date'>
): AccountPeriodView => ({
  polla_current_account_id: `${edition.polla_edition_id}:${row.polla_user_id}`,
  polla_user_id: row.polla_user_id,
  user_name: row.user_name,
  user_number: row.user_number,
  polla_organization_id: '',
  polla_group_id: row.polla_group_id,
  date: edition.end_date,
  period_from: edition.start_date,
  bets_pass: row.bets_pass,
  deleted_pass: row.deleted_pass,
  pass: row.pass,
  successes: 0,
  cashier_commission: row.cashier_commission,
  claims: row.claims,
  subtotal: row.subtotal,
  revenue: row.revenue,
  previous_balance: 0,
  previous_drag: 0,
  collections: row.collections,
  paid: row.paid,
  bills: 0,
  total: row.total,
  drag: 0,
  leave: 0,
  is_liquidated: row.liquidation !== null,
  created_at: '',
  edited_at: '',
});

/**
 * `Edicion_<título>` para el nombre de archivo: cada tramo de espacios o de
 * caracteres que un nombre de archivo no admite (`\/:*?"<>|`) pasa a un `_`.
 * `Semana 9/11` queda `Edicion_Semana_9_11`.
 */
export const editionFileTag = (title: string) =>
  `Edicion_${title
    .trim()
    .replace(/[\s\\/:*?"<>|]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;

/** Ediciones que empiezan en el rango (inclusivo en las dos puntas); `start_date` es `YYYY-MM-DD`. */
export const editionsInRange = (items: IPollaEditionAccountListItem[], from: string, to: string) =>
  items.filter((item) => item.edition.start_date >= from && item.edition.start_date <= to);

/**
 * Las del rango que entran en los reportes de "Varias ediciones": sin las que
 * tienen la carga abierta, porque su cuenta todavía se mueve. Una sola se
 * sigue exportando desde su detalle ("Una edición").
 */
export const reportEditionsInRange = (
  items: IPollaEditionAccountListItem[],
  from: string,
  to: string
) => editionsInRange(items, from, to).filter((item) => !item.load_open);

/** Comisión del admin: `GREATEST(base, 0) × % / 100` redondeada a 2, con el % también a 2 decimales (igual que la función SQL). */
export const groupCommission = (base: number, percentage: number): number =>
  Math.round(Math.max(base, 0) * (Math.round(percentage * 100) / 100)) / 100;

const cents = (value: number | string | null | undefined) => Math.round(Number(value ?? 0) * 100);

/**
 * Cómo se reparte el total del grupo (lo que dejaron los pasadores menos los
 * gastos): al admin, el 100% de su comisión (se la transfiere el capitalista
 * por afuera); al capitalista, el resto.
 */
export const groupSplit = (
  total: number | string,
  adminCommission: number | string
): { admin: number; capitalist: number } => ({
  admin: cents(adminCommission) / 100,
  capitalist: (cents(total) - cents(adminCommission)) / 100,
});

/**
 * La cuenta guardada del grupo quedó vieja: lo que dejaron los pasadores o los
 * gastos de la edición (y con eso la base) ya no son los de su liquidación.
 * Sin liquidación, no hay nada viejo.
 */
export const groupAccountOutdated = (
  preview: Pick<IPollaGroupEditionAccountPreview, 'cashiers_subtotal' | 'expenses' | 'account'>
): boolean => {
  const { account } = preview;
  if (!account) return false;
  return (
    cents(account.cashiers_subtotal) !== cents(preview.cashiers_subtotal) ||
    cents(account.expenses) !== cents(preview.expenses)
  );
};

/** Monto escrito a mano: acepta coma decimal; vacío o inválido → `null`. */
export const parseAmount = (raw: string): number | null => {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
};

/** Lo que se suma hoy a un pasador en "Generar liquidación". */
export interface IEditionNewMovements {
  collection: number;
  payment: number;
  /** Con signo: un reclamo negativo resta. */
  claim: number;
}

/** `ROUND(x)` de Postgres: la mitad se aleja del cero. */
const roundHalfAway = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

/**
 * La fila con los movimientos que se suman hoy, con la fórmula de la base
 * (`polla_edition_account_base`): un reclamo positivo suma al pase (y a la
 * comisión); uno negativo, al subtotal. `total = subtotal − cobros + pagos`.
 */
export const withNewMovements = (
  row: IPollaEditionAccountRow,
  added: IEditionNewMovements
): IPollaEditionAccountRow => {
  const tickets = cents(row.bets_pass) - cents(row.deleted_pass);
  const claimsPos = cents(row.pass) - tickets + Math.max(cents(added.claim), 0);
  const claimsNeg =
    cents(row.claims) - (cents(row.pass) - tickets) + Math.min(cents(added.claim), 0);
  const pass = tickets + claimsPos;
  const commission = roundHalfAway((pass * Number(row.fee ?? 0)) / 100);
  const subtotal = pass - commission + claimsNeg;
  const collections = cents(row.collections) + cents(added.collection);
  const paid = cents(row.paid) + cents(added.payment);

  return {
    ...row,
    claims: (cents(row.claims) + cents(added.claim)) / 100,
    pass: pass / 100,
    cashier_commission: commission / 100,
    subtotal: subtotal / 100,
    revenue: subtotal / 100,
    collections: collections / 100,
    paid: paid / 100,
    total: (subtotal - collections + paid) / 100,
  };
};

/**
 * `Debe` si el pasador tiene que pasar plata o la cuenta está en cero; `Cobra`
 * si le deben a él. Un saldo en cero nunca dice "Cobra $0".
 */
export const owedWord = (total: number | string): 'Debe' | 'Cobra' =>
  Number(total) < 0 ? 'Cobra' : 'Debe';
