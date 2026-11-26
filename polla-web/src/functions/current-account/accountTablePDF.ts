import dayjs from 'dayjs';
import { IPollaCurrentAccountDailyTotals } from '@helper/polla/types/game.type';
import { AccountPeriodView } from '@/lib/accountPeriod';
import {
  ACCOUNT_MONEY_HEAD,
  PdfDoc,
  accountMoneyCells,
  addFooterPageNumbers,
  buildColumnStyles,
  computeAccountTotals,
  getPDFDeps,
  gridTableOptions,
  lastTableY,
  money,
  openPDFPrintDialog,
} from './pdf-shared';

const BASE_FONT = 8;
const CELL_PAD = 1;
const MARGIN = { left: 14, right: 14 };

const slug = (text?: string) => (text ? `_${text.trim().replace(/\s+/g, '_')}` : '');

const newDoc = async () => {
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as PdfDoc;
  const available = doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right;
  doc.setFontSize(BASE_FONT);
  const minMoneyCol = doc.getTextWidth('-9.999.999,9') + CELL_PAD * 2 + 0.5;
  return { doc, autoTable, available, minMoneyCol };
};

/**
 * Planilla a una fecha, una fila por pasador con lo acumulado desde su última
 * liquidación (o en el rango que arranca en `from`). Es "Exportar diario"
 * (el parte diario) y, con un grupo, el resumen de un día de ese grupo.
 */
export async function downloadDailyAccountsPDF(params: {
  date: string;
  rows: AccountPeriodView[];
  /** Liquidación por rango: primer día del rango. */
  from?: string;
  title: string;
  groupName?: string;
  /** Cuenta por edición: reemplaza el texto del período bajo el título. */
  periodText?: string;
  /** Cuenta por edición: va en el nombre del archivo en lugar de la fecha. */
  fileTag?: string;
  /** Nombre completo del archivo (el parte diario, `pollaDailyReportName`). */
  fileName?: string;
}) {
  const { doc, autoTable, available, minMoneyCol } = await newDoc();
  const title = params.title;
  const dateStr = dayjs(params.date).format('DD/MM/YYYY');
  const fileName =
    params.fileName ??
    `polla_${title.replace(/\s+/g, '_')}${slug(params.groupName)}_${params.fileTag ?? dayjs(params.date).format('DD-MM-YYYY')}`;

  doc.setProperties({ title: fileName });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(10);
  doc.text(
    params.periodText ??
      (params.from
        ? `Del ${dayjs(params.from).format('DD/MM/YYYY')} al ${dateStr}`
        : `Acumulado desde la última liquidación de cada pasador hasta el ${dateStr}`),
    14,
    20
  );
  if (params.groupName) doc.text(`Grupo: ${params.groupName}`, 14, 26);
  const startY = params.groupName ? 32 : 26;
  doc.setFontSize(BASE_FONT);

  const options = gridTableOptions({
    fontSize: BASE_FONT,
    cellPadding: CELL_PAD,
    margin: MARGIN,
    width: available,
    columnStyles: buildColumnStyles({
      available,
      minMoneyCol,
      leadColumns: [16, 14, 24],
      moneyColumns: ACCOUNT_MONEY_HEAD.length,
    }),
  });

  autoTable(doc, {
    ...options,
    head: [['Número', 'Desde', 'Nombre', ...ACCOUNT_MONEY_HEAD]],
    body: params.rows.map((row) => [
      row.user_number ?? '',
      dayjs(row.period_from).format('DD/MM'),
      row.user_name ?? '',
      ...accountMoneyCells(row),
    ]),
    startY,
  });

  autoTable(doc, {
    ...options,
    head: [['', '', '', ...ACCOUNT_MONEY_HEAD]],
    body: [['Totales', '', '', ...accountMoneyCells(computeAccountTotals(params.rows))]],
    startY: lastTableY(doc, startY) + 6,
  });

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, fileName);
}

/**
 * Totales de un renglón del resumen. `label` es la cuenta por edición con
 * varias ediciones: el título de la edición, para distinguir dos que empiezan
 * el mismo día.
 */
export type SummaryTotalsRow = IPollaCurrentAccountDailyTotals & { label?: string };

/** Primera columna del resumen: la fecha o, con `label`, `DD/MM · título`. */
export const summaryRowLabel = (row: Pick<SummaryTotalsRow, 'date' | 'label'>) =>
  row.label
    ? `${dayjs(row.date).format('DD/MM')} · ${row.label}`
    : dayjs(row.date).format('DD/MM/YYYY');

/** Resumen por fecha de un período (una fila por día) o por edición (una por edición). */
export async function downloadDailySummaryPDF(params: {
  from: string;
  to: string;
  totals: SummaryTotalsRow[];
  groupName?: string;
  /** El parte diario de varias ediciones cambia el título y el nombre. */
  title?: string;
  fileName?: string;
}) {
  const { doc, autoTable, available, minMoneyCol } = await newDoc();
  const fromFile = dayjs(params.from).format('DD-MM-YYYY');
  const toFile = dayjs(params.to).format('DD-MM-YYYY');
  const fileName =
    params.fileName ??
    `polla_Resumen_Cuenta_Corriente${slug(params.groupName)}_${fromFile}_${toFile}`;

  doc.setProperties({ title: fileName });
  doc.setFontSize(14);
  doc.text(params.title ?? 'Resumen Cuenta Corriente', 14, 14);
  doc.setFontSize(10);
  doc.text(
    `Período: ${dayjs(params.from).format('DD/MM/YYYY')} al ${dayjs(params.to).format('DD/MM/YYYY')}`,
    14,
    20
  );
  if (params.groupName) doc.text(`Grupo: ${params.groupName}`, 14, 26);
  const startY = params.groupName ? 32 : 26;
  doc.setFontSize(BASE_FONT);

  // Con títulos de edición la primera columna se ensancha (y corta con "…").
  const labeled = params.totals.some((t) => t.label);
  const options = gridTableOptions({
    fontSize: BASE_FONT,
    cellPadding: CELL_PAD,
    margin: MARGIN,
    width: available,
    columnStyles: buildColumnStyles({
      available,
      minMoneyCol,
      leadColumns: [labeled ? 70 : 22],
      moneyColumns: ACCOUNT_MONEY_HEAD.length,
    }),
  });

  const asAccount = (t: IPollaCurrentAccountDailyTotals) => ({
    bets_pass: t.total_bets_pass,
    deleted_pass: t.total_deleted_pass,
    pass: t.total_pass,
    claims: t.total_claims,
    subtotal: t.total_subtotal,
    previous_balance: t.total_previous_balance,
    collections: t.total_collections,
    paid: t.total_paid,
    total: t.total_total,
  });

  autoTable(doc, {
    ...options,
    head: [[labeled ? 'Edición' : 'Fecha', ...ACCOUNT_MONEY_HEAD]],
    body: params.totals.map((t) => [summaryRowLabel(t), ...accountMoneyCells(asAccount(t))]),
    startY,
  });

  const sum = (pick: (t: IPollaCurrentAccountDailyTotals) => number) =>
    params.totals.reduce((acc, t) => acc + Number(pick(t) || 0), 0);

  autoTable(doc, {
    ...options,
    head: [['', ...ACCOUNT_MONEY_HEAD]],
    body: [
      [
        'Totales',
        money(sum((t) => t.total_bets_pass)),
        money(sum((t) => t.total_deleted_pass)),
        money(sum((t) => t.total_pass)),
        money(sum((t) => t.total_claims)),
        money(sum((t) => t.total_subtotal)),
        money(sum((t) => t.total_previous_balance)),
        money(sum((t) => t.total_collections)),
        money(sum((t) => t.total_paid)),
        money(sum((t) => t.total_total)),
      ],
    ],
    startY: lastTableY(doc, startY) + 6,
  });

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, fileName);
}
