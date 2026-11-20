import dayjs from 'dayjs';
import {
  IPollaGroupEditionAccountEntity,
  IPollaGroupEditionAccountPreview,
} from '@helper/polla/types/game.type';
import { groupAccountOutdated } from '@/lib/editionAccount';

/**
 * Parte diario de grupos (pedido del 17/11/2026): por cada grupo liquidado, el
 * total (lo que dejaron sus pasadores menos los gastos del grupo), lo que va
 * al admin y lo que le queda al capitalista. Solo cuentan las liquidaciones
 * guardadas; los pasadores sin grupo no entran. Funciones puras.
 */

export type GroupReportAccount = Pick<
  IPollaGroupEditionAccountEntity,
  'polla_group_id' | 'polla_edition_id' | 'group_name' | 'base' | 'admin_commission' | 'edited_at'
>;

export type GroupRef = { number: number; name: string };

export interface GroupReportAmounts {
  total: number;
  admin: number;
  capitalist: number;
}

export interface GroupReportRow extends GroupReportAmounts {
  groupId: string;
  /** `Grupo N - Nombre` (o el nombre guardado, si el grupo ya no está). */
  label: string;
}

export interface GroupRangeEditionRow extends GroupReportAmounts {
  editionId: string;
  /** `YYYY-MM-DD` (hora local) de la última liquidación de sus grupos en el rango. */
  liquidatedAt: string;
}

const cents = (value: number | string | null | undefined) => Math.round(Number(value ?? 0) * 100);

/** Suma en centavos y devuelve pesos, sin errores de coma flotante. */
const sumAmounts = (items: GroupReportAmounts[]): GroupReportAmounts => {
  const acc = items.reduce(
    (sum, item) => ({
      total: sum.total + cents(item.total),
      admin: sum.admin + cents(item.admin),
      capitalist: sum.capitalist + cents(item.capitalist),
    }),
    { total: 0, admin: 0, capitalist: 0 }
  );
  return { total: acc.total / 100, admin: acc.admin / 100, capitalist: acc.capitalist / 100 };
};

/** Lo que va a cada uno: el total, la comisión del admin y el resto para el capitalista. */
const amountsOf = (account: GroupReportAccount): GroupReportAmounts => ({
  total: cents(account.base) / 100,
  admin: cents(account.admin_commission) / 100,
  capitalist: (cents(account.base) - cents(account.admin_commission)) / 100,
});

const groupLabel = (account: GroupReportAccount, group?: GroupRef) =>
  group ? `Grupo ${group.number} - ${group.name}` : account.group_name;

/** Por número de grupo; los que ya no están en el catálogo, al final por nombre. */
const byGroup =
  (groupById: Map<string, GroupRef>) =>
  (a: { groupId: string; label: string }, b: { groupId: string; label: string }) => {
    const na = groupById.get(a.groupId)?.number ?? Number.POSITIVE_INFINITY;
    const nb = groupById.get(b.groupId)?.number ?? Number.POSITIVE_INFINITY;
    if (na !== nb) return na < nb ? -1 : 1;
    return a.label.localeCompare(b.label, 'es');
  };

/**
 * Filas del parte diario de una edición, una por grupo liquidado, o del
 * resumen por grupo de un rango (suma las ediciones de cada grupo).
 */
export const groupReportRows = (
  accounts: GroupReportAccount[],
  groupById: Map<string, GroupRef>
): GroupReportRow[] => {
  const byId = new Map<string, { label: string; items: GroupReportAmounts[] }>();
  for (const account of accounts) {
    const entry = byId.get(account.polla_group_id) ?? {
      label: groupLabel(account, groupById.get(account.polla_group_id)),
      items: [],
    };
    entry.items.push(amountsOf(account));
    byId.set(account.polla_group_id, entry);
  }
  return [...byId]
    .map(([groupId, { label, items }]) => ({ groupId, label, ...sumAmounts(items) }))
    .sort(byGroup(groupById));
};

/** Totales del parte: total, admin y capitalista. */
export const groupReportTotals = (rows: GroupReportAmounts[]): GroupReportAmounts =>
  sumAmounts(rows);

/** Fecha del parte (`YYYY-MM-DD`, hora local): la última liquidación de sus grupos. */
export const groupReportDate = (accounts: Pick<GroupReportAccount, 'edited_at'>[]) => {
  const latest = accounts.reduce<string | null>(
    (max, account) =>
      max === null || dayjs(account.edited_at).isAfter(dayjs(max)) ? account.edited_at : max,
    null
  );
  return latest ? dayjs(latest).format('YYYY-MM-DD') : null;
};

type PreviewForReport = Pick<
  IPollaGroupEditionAccountPreview,
  'group_name' | 'cashiers_subtotal' | 'expenses' | 'base' | 'pending_cashiers' | 'account'
>;

/**
 * Grupos que faltan liquidar en la edición: los que no tienen liquidación y
 * tienen algo (pase, gastos o pasadores sin liquidar). Los que no movieron
 * nada no se avisan.
 */
export const unliquidatedGroupNames = (previews: PreviewForReport[]) =>
  previews
    .filter(
      (preview) =>
        !preview.account &&
        (cents(preview.base) !== 0 ||
          cents(preview.cashiers_subtotal) !== 0 ||
          cents(preview.expenses) !== 0 ||
          preview.pending_cashiers.length > 0)
    )
    .map((preview) => preview.group_name);

/** Grupos con la liquidación vieja (cambió lo que dejaron sus pasadores o los gastos). */
export const outdatedGroupNames = (previews: PreviewForReport[]) =>
  previews.filter((preview) => groupAccountOutdated(preview)).map((preview) => preview.group_name);

/**
 * Rango: una fila por edición con la suma de sus grupos, ordenadas por fecha
 * de liquidación (la última de sus grupos en el rango).
 */
export const groupRangeByEdition = (accounts: GroupReportAccount[]): GroupRangeEditionRow[] => {
  const byEdition = new Map<string, GroupReportAccount[]>();
  for (const account of accounts) {
    const list = byEdition.get(account.polla_edition_id) ?? [];
    list.push(account);
    byEdition.set(account.polla_edition_id, list);
  }
  return [...byEdition]
    .map(([editionId, list]) => ({
      editionId,
      liquidatedAt: groupReportDate(list) ?? '',
      ...sumAmounts(list.map(amountsOf)),
    }))
    .sort((a, b) =>
      a.liquidatedAt === b.liquidatedAt
        ? a.editionId.localeCompare(b.editionId)
        : a.liquidatedAt < b.liquidatedAt
          ? -1
          : 1
    );
};
