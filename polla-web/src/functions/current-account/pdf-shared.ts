import type { jsPDF } from 'jspdf';
import type { Styles, UserOptions } from 'jspdf-autotable';
import { IPollaCurrentAccountEntityFront } from '@helper/polla/types/game.type';

/**
 * Base común de los PDFs de la cuenta corriente. Mismas convenciones que
 * `web/src/functions/pdf-shared.ts` (A4 apaisado, grilla negra fina, montos sin
 * decimales), sin Arrastre ni Deje: la liquidación de Polla no tiene deje.
 */

export type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];
const BASE_LINE = 0.15;

export const BORDER_CELL: Partial<Styles> = { lineWidth: BASE_LINE, lineColor: BLACK };

export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(
    Number.isFinite(Number(n)) ? Number(n) : 0
  );

export async function getPDFDeps() {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  return { jsPDF, autoTable };
}

export const lastTableY = (doc: PdfDoc, fallback: number) => doc.lastAutoTable?.finalY ?? fallback;

export function addFooterPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
}

/** Opciones de una tabla de la cuenta corriente: grilla blanca con bordes negros. */
export function gridTableOptions(params: {
  fontSize: number;
  cellPadding: number;
  margin: { left: number; right: number };
  width: number;
  columnStyles: UserOptions['columnStyles'];
}): Partial<UserOptions> {
  return {
    margin: params.margin,
    theme: 'grid',
    tableLineWidth: BASE_LINE,
    tableLineColor: BLACK,
    styles: {
      ...BORDER_CELL,
      fontSize: params.fontSize,
      cellPadding: params.cellPadding,
      overflow: 'linebreak',
      fillColor: WHITE,
      textColor: BLACK,
    },
    headStyles: {
      ...BORDER_CELL,
      halign: 'center',
      fontSize: params.fontSize,
      fillColor: WHITE,
      textColor: BLACK,
    },
    bodyStyles: { ...BORDER_CELL, fillColor: WHITE, textColor: BLACK },
    alternateRowStyles: { fillColor: WHITE },
    columnStyles: params.columnStyles,
    tableWidth: params.width,
  };
}

/** Anchos para tablas con una columna de etiqueta (o dos: número y nombre) y N de montos. */
export function buildColumnStyles(params: {
  available: number;
  minMoneyCol: number;
  leadColumns: number[];
  moneyColumns: number;
}): UserOptions['columnStyles'] {
  const leadWidth = params.leadColumns.reduce((acc, width) => acc + width, 0);
  const moneyWidth = Math.max(
    Math.ceil(params.minMoneyCol),
    Math.floor((params.available - leadWidth) / params.moneyColumns)
  );
  // Lo que sobra va a la última columna de texto (el nombre).
  const leftover = Math.max(0, params.available - leadWidth - moneyWidth * params.moneyColumns);
  const lead = params.leadColumns.map((width, i) =>
    i === params.leadColumns.length - 1 ? width + leftover : width
  );

  return {
    ...Object.fromEntries(
      lead.map((width, i) => [i, { cellWidth: width, halign: 'left', overflow: 'ellipsize' }])
    ),
    ...Object.fromEntries(
      Array.from({ length: params.moneyColumns }, (_, i) => [
        i + lead.length,
        { cellWidth: moneyWidth, halign: 'right', overflow: 'hidden' },
      ])
    ),
  };
}

/**
 * Abre el diálogo de impresión. Cambia `document.title` mientras tanto para que
 * el navegador lo use como nombre sugerido al guardar como PDF.
 */
export function openPDFPrintDialog(doc: jsPDF, filename: string) {
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
    const cleanup = () => {
      document.title = prev;
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
      iframe.contentWindow?.removeEventListener('afterprint', cleanup);
    };
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    iframe.contentWindow?.print();
  };
}

/** Columnas de montos de la planilla de la cuenta corriente (sin Arrastre ni Deje). */
export const ACCOUNT_MONEY_HEAD = [
  'Pase',
  'Aciertos',
  'Reclamos',
  'Subtotal',
  'Deuda',
  'Cobros',
  'Pagos',
  'Total',
];

export const accountMoneyCells = (a: {
  pass: number;
  successes: number;
  claims: number;
  subtotal: number;
  previous_balance: number;
  collections: number;
  paid: number;
  total: number;
}) => [
  money(a.pass),
  money(a.successes),
  money(a.claims),
  money(a.subtotal),
  money(a.previous_balance),
  money(a.collections),
  money(a.paid),
  money(a.total),
];

export const computeAccountTotals = (rows: IPollaCurrentAccountEntityFront[]) =>
  rows.reduce(
    (acc, row) => ({
      pass: acc.pass + Number(row.pass || 0),
      successes: acc.successes + Number(row.successes || 0),
      claims: acc.claims + Number(row.claims || 0),
      subtotal: acc.subtotal + Number(row.subtotal || 0),
      previous_balance: acc.previous_balance + Number(row.previous_balance || 0),
      collections: acc.collections + Number(row.collections || 0),
      paid: acc.paid + Number(row.paid || 0),
      total: acc.total + Number(row.total || 0),
    }),
    {
      pass: 0,
      successes: 0,
      claims: 0,
      subtotal: 0,
      previous_balance: 0,
      collections: 0,
      paid: 0,
      total: 0,
    }
  );
