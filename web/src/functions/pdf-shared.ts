'use client';

import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';

const BASE_LINE = 0.15;
export const BORDER_CELL = { lineWidth: BASE_LINE, lineColor: [0, 0, 0] as [number, number, number] };
export const BORDER_TABLE = {
  tableLineWidth: BASE_LINE,
  tableLineColor: [0, 0, 0] as [number, number, number],
};

export const money = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(n) ? n : 0);

export async function getPDFDeps() {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default as any;
  return { jsPDF, autoTable };
}

export function addFooterPageNumbers(doc: any) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
}

export function buildBaseStyles(BASE_FONT: number, CELL_PAD: number) {
  return {
    ...BORDER_CELL,
    fontSize: BASE_FONT,
    cellPadding: CELL_PAD,
    overflow: 'linebreak',
    fillColor: [255, 255, 255],
    textColor: [0, 0, 0],
  };
}

/** Anchos para tablas con col Número + col Nombre + N cols numéricas */
export function buildTwoColAccountWidths(available: number, minMoneyCol: number, MONEY_COL_COUNT = 10) {
  const NUMBER_COL = 16;
  const MIN_NAME = 24;
  let moneyColWidth = Math.ceil(minMoneyCol);
  let nameColWidth = MIN_NAME;
  let used = NUMBER_COL + nameColWidth + moneyColWidth * MONEY_COL_COUNT;
  let leftover = available - used;

  if (leftover > 0) {
    moneyColWidth = Math.floor(moneyColWidth + leftover / MONEY_COL_COUNT);
    used = NUMBER_COL + nameColWidth + moneyColWidth * MONEY_COL_COUNT;
    leftover = available - used;
    if (leftover > 0) nameColWidth += leftover;
  } else {
    const deficit = -leftover;
    moneyColWidth = Math.max(Math.ceil(minMoneyCol), moneyColWidth - Math.ceil(deficit / MONEY_COL_COUNT));
    nameColWidth = Math.max(MIN_NAME, available - NUMBER_COL - moneyColWidth * MONEY_COL_COUNT);
  }

  return { numberColWidth: NUMBER_COL, nameColWidth, moneyColWidth };
}

/** Anchos para tablas con col Fecha + N cols numéricas */
export function buildDateColAccountWidths(available: number, minMoneyCol: number, MONEY_COL_COUNT = 10) {
  const DATE_COL = 22;
  let moneyColWidth = Math.ceil(minMoneyCol);
  let used = DATE_COL + moneyColWidth * MONEY_COL_COUNT;
  let leftover = available - used;

  if (leftover > 0) {
    moneyColWidth = Math.floor(moneyColWidth + leftover / MONEY_COL_COUNT);
    used = DATE_COL + moneyColWidth * MONEY_COL_COUNT;
    leftover = available - used;
  }

  return { dateColWidth: DATE_COL + Math.max(0, leftover), moneyColWidth };
}

/** Abre el diálogo de impresión. Cambia document.title temporalmente para que Chrome lo use como nombre de archivo sugerido al guardar como PDF. */
export function openPDFPrintDialog(doc: any, filename: string) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    const prev = document.title;
    document.title = filename;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.title = prev;
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
}

export const computeTotals = (rows: ICurrentAccountEntityFront[]) =>
  rows.reduce(
    (acc, it) => ({
      pass: acc.pass + (it.pass || 0),
      successes: acc.successes + (it.successes || 0),
      claims: acc.claims + (it.claims || 0),
      subtotal: acc.subtotal + (it.subtotal || 0),
      previous_balance: acc.previous_balance + (it.previous_balance || 0),
      collections: acc.collections + (it.collections || 0),
      paid: acc.paid + (it.paid || 0),
      total: acc.total + (it.total || 0),
      drag: acc.drag + (it.drag || 0),
      leave: acc.leave + (it.leave || 0),
    }),
    { pass: 0, successes: 0, claims: 0, subtotal: 0, previous_balance: 0, collections: 0, paid: 0, total: 0, drag: 0, leave: 0 }
  );
