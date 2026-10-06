import dayjs from 'dayjs';
import {
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountEntityFront,
} from '@helper/polla/types/game.type';
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
 * Planilla de un día, una fila por pasador. Es "Exportar diario" y, con un
 * grupo, el resumen de un día de ese grupo.
 */
export async function downloadDailyAccountsPDF(params: {
  date: string;
  rows: IPollaCurrentAccountEntityFront[];
  title?: string;
  groupName?: string;
}) {
  const { doc, autoTable, available, minMoneyCol } = await newDoc();
  const title = params.title ?? 'Liquidación';
  const dateStr = dayjs(params.date).format('DD/MM/YYYY');
  const fileName = `${title.replace(/\s+/g, '_')}${slug(params.groupName)}_${dayjs(params.date).format('DD-MM-YYYY')}`;

  doc.setProperties({ title: fileName });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(10);
  doc.text(`Fecha de la liquidación: ${dateStr}`, 14, 20);
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
      leadColumns: [16, 24],
      moneyColumns: ACCOUNT_MONEY_HEAD.length,
    }),
  });

  autoTable(doc, {
    ...options,
    head: [['Número', 'Nombre', ...ACCOUNT_MONEY_HEAD]],
    body: params.rows.map((row) => [
      row.user_number ?? '',
      row.user_name ?? '',
      ...accountMoneyCells(row),
    ]),
    startY,
  });

  autoTable(doc, {
    ...options,
    head: [['', '', ...ACCOUNT_MONEY_HEAD]],
    body: [['Totales', '', ...accountMoneyCells(computeAccountTotals(params.rows))]],
    startY: lastTableY(doc, startY) + 6,
  });

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, fileName);
}

/** Resumen por fecha de un período: una fila por día con los totales. */
export async function downloadDailySummaryPDF(params: {
  from: string;
  to: string;
  totals: IPollaCurrentAccountDailyTotals[];
  groupName?: string;
}) {
  const { doc, autoTable, available, minMoneyCol } = await newDoc();
  const fromFile = dayjs(params.from).format('DD-MM-YYYY');
  const toFile = dayjs(params.to).format('DD-MM-YYYY');
  const fileName = `Resumen_Cuenta_Corriente${slug(params.groupName)}_${fromFile}_${toFile}`;

  doc.setProperties({ title: fileName });
  doc.setFontSize(14);
  doc.text('Resumen Cuenta Corriente', 14, 14);
  doc.setFontSize(10);
  doc.text(
    `Período: ${dayjs(params.from).format('DD/MM/YYYY')} al ${dayjs(params.to).format('DD/MM/YYYY')}`,
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
      leadColumns: [22],
      moneyColumns: ACCOUNT_MONEY_HEAD.length,
    }),
  });

  const asAccount = (t: IPollaCurrentAccountDailyTotals) => ({
    pass: t.total_pass,
    successes: t.total_successes,
    claims: t.total_claims,
    subtotal: t.total_subtotal,
    previous_balance: t.total_previous_balance,
    collections: t.total_collections,
    paid: t.total_paid,
    total: t.total_total,
  });

  autoTable(doc, {
    ...options,
    head: [['Fecha', ...ACCOUNT_MONEY_HEAD]],
    body: params.totals.map((t) => [
      dayjs(t.date).format('DD/MM/YYYY'),
      ...accountMoneyCells(asAccount(t)),
    ]),
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
        money(sum((t) => t.total_pass)),
        money(sum((t) => t.total_successes)),
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
