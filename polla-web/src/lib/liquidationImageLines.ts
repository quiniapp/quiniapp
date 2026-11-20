import dayjs from 'dayjs';
import { AccountPeriodView, periodLabel } from '@/lib/accountPeriod';
import { owedWord } from '@/lib/editionAccount';
import {
  type GroupLiquidationSheet,
  groupLiquidationLabel,
  groupLiquidationPaidMark,
  groupLiquidationRows,
  money,
} from '@/lib/groupLiquidation';
import { liquidationSlipAmounts } from '@/lib/liquidationSlip';

/**
 * Contenido de la liquidación en imagen, como renglones que dibuja
 * `renderLiquidationImage`. Funciones puras (sin canvas): salen de los mismos
 * montos que las hojas PDF.
 */

export type ImageLine =
  | { kind: 'title'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'row'; label: string; value: string; strong?: boolean }
  | { kind: 'divider' };

const GROUP_STRONG = new Set(['Total', 'Total admin', 'Total capitalista', 'Debe', 'Cobra']);

/** Imagen de un grupo: organización, grupo, edición y fecha; después los renglones de la hoja. */
export const groupLiquidationImageLines = (sheet: GroupLiquidationSheet): ImageLine[] => {
  const rows = groupLiquidationRows(sheet.account).map(
    (row): ImageLine => ({ kind: 'row', ...row, strong: GROUP_STRONG.has(row.label) })
  );
  const orgName = sheet.orgName.trim();
  const paidMark = groupLiquidationPaidMark(sheet.account);
  return [
    ...(orgName ? [{ kind: 'title', text: orgName.toUpperCase() } as const] : []),
    { kind: 'title', text: groupLiquidationLabel(sheet.group) },
    { kind: 'text', text: `Edición ${sheet.editionTitle}` },
    { kind: 'text', text: dayjs(sheet.date).format('DD/MM/YYYY') },
    { kind: 'divider' },
    ...rows.slice(0, 3),
    { kind: 'divider' },
    ...rows.slice(3),
    ...(paidMark ? [{ kind: 'row', label: paidMark, value: '', strong: true } as const] : []),
  ];
};

/** Imagen de un pasador: los montos de su hoja PDF, con "Subtotal" una sola vez. */
export const cashierLiquidationImageLines = (p: {
  account: AccountPeriodView;
  headerLabel?: string;
}): ImageLine[] => {
  const { account, headerLabel } = p;
  const a = liquidationSlipAmounts(account);
  const row = (label: string, value: number, strong = false): ImageLine => ({
    kind: 'row',
    label,
    value: money(value),
    ...(strong && { strong }),
  });
  const dateStr = periodLabel(account.period_from, account.date, 'D/M/YYYY');
  return [
    { kind: 'title', text: `Nro ${account.user_number ?? ''} · ${account.user_name ?? ''}` },
    {
      kind: 'text',
      text:
        headerLabel !== undefined
          ? `Edición ${headerLabel}`
          : `${account.period_from === account.date ? 'Fecha' : 'Período'} ${dateStr}`,
    },
    { kind: 'divider' },
    row('Pase jugadas', a.bets_pass),
    row('Borradas', a.deleted_pass),
    row('Pase', a.pass),
    row('Comisión', a.cashier_commission),
    row('Reclamos', a.claims),
    row('Subtotal', a.subtotal),
    { kind: 'divider' },
    row('Saldo', a.previous_balance),
    row('Cobré', a.collections),
    row('Pagué', a.paid),
    row('Gastos', a.bills),
    { kind: 'divider' },
    row('Deja', a.revenue, true),
    row(owedWord(a.total), Math.abs(a.total), true),
  ];
};
