import dayjs from 'dayjs';
import type { CellInput, RowInput } from 'jspdf-autotable';
import { GroupRangeEditionRow, GroupReportAmounts, GroupReportRow } from '@/lib/groupDailyReport';
import {
  PdfDoc,
  addFooterPageNumbers,
  getPDFDeps,
  gridTableOptions,
  lastTableY,
  openPDFPrintDialog,
} from './pdf-shared';

/**
 * Parte diario de grupos (A4 vertical): lo que le quedó al admin y al
 * capitalista de cada grupo, por edición o sumado en un rango.
 */

const FONT = 10;
const MARGIN = { left: 14, right: 14 };

const bold = (content: string, halign: 'left' | 'right' = 'left'): CellInput => ({
  content,
  styles: { fontStyle: 'bold', halign },
});
const right = (content: string): CellInput => ({ content, styles: { halign: 'right' } });
/** Hasta 2 decimales: lo del admin y del capitalista se paga al centavo. */
const MONEY_2 = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const pesos = (n: number) => `$${MONEY_2.format(Number.isFinite(n) ? n : 0)}`;

const newDoc = async () => {
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const width = doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right;
  return { doc, autoTable, width };
};

/** Título y renglones de encabezado; devuelve dónde arranca la tabla. */
const header = (doc: PdfDoc, title: string, lines: string[]) => {
  doc.setFontSize(14);
  doc.text(title, MARGIN.left, 16);
  doc.setFontSize(10);
  lines.forEach((line, index) => doc.text(line, MARGIN.left, 23 + index * 6));
  return 23 + lines.length * 6;
};

/** Tabla Grupo | Total | Admin con la fila de totales y, abajo, el total del capitalista. */
const groupsTable = (
  doc: PdfDoc,
  autoTable: Awaited<ReturnType<typeof getPDFDeps>>['autoTable'],
  width: number,
  startY: number,
  rows: GroupReportRow[],
  totals: GroupReportAmounts
) => {
  const body: RowInput[] = rows.map((row) => [
    row.label,
    right(pesos(row.total)),
    right(pesos(row.admin)),
  ]);
  body.push([
    bold('Total'),
    bold(pesos(totals.total), 'right'),
    bold(pesos(totals.admin), 'right'),
  ]);

  autoTable(doc, {
    ...gridTableOptions({
      fontSize: FONT,
      cellPadding: 1.5,
      margin: MARGIN,
      width,
      columnStyles: { 0: { cellWidth: width - 80 }, 1: { cellWidth: 40 }, 2: { cellWidth: 40 } },
    }),
    head: [['Grupo', 'Total', '$ Admin']],
    body,
    startY,
  });

  const y = lastTableY(doc, startY) + 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total capitalista: ${pesos(totals.capitalist)}`, MARGIN.left, y);
  doc.setFont('helvetica', 'normal');
  return y;
};

/** Avisos al pie (grupos sin liquidar, liquidaciones viejas). */
const notes = (doc: PdfDoc, startY: number, width: number, lines: string[]) => {
  doc.setFontSize(9);
  let y = startY;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, width) as string[];
    doc.text(wrapped, MARGIN.left, y);
    y += wrapped.length * 4.5 + 1.5;
  }
};

/** Parte diario de grupos de una edición. */
export async function downloadGroupDailyReportPDF(params: {
  /** Título de la edición. */
  editionTitle: string;
  /** `YYYY-MM-DD` de la liquidación (la última de sus grupos). */
  date: string;
  rows: GroupReportRow[];
  totals: GroupReportAmounts;
  /** Grupos con movimiento que todavía no se liquidaron. */
  unliquidated: string[];
  /** Grupos con la liquidación vieja. */
  outdated: string[];
  /** T�tulo del PDF, con el juego (`pollaDailyReportTitle`). */
  title: string;
  fileName: string;
}) {
  const { doc, autoTable, width } = await newDoc();
  doc.setProperties({ title: params.fileName });

  const startY = header(doc, params.title, [
    `Edición: ${params.editionTitle}`,
    `Liquidación: ${dayjs(params.date).format('DD/MM/YYYY')}`,
  ]);
  const y = groupsTable(doc, autoTable, width, startY, params.rows, params.totals);

  const warnings: string[] = [];
  if (params.unliquidated.length > 0) {
    warnings.push(`Sin liquidar (no entran en el parte): ${params.unliquidated.join(', ')}.`);
  }
  if (params.outdated.length > 0) {
    warnings.push(
      `Cambiaron desde su liquidación (sale lo liquidado): ${params.outdated.join(', ')}.`
    );
  }
  notes(doc, y + 8, width, warnings);

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, params.fileName);
}

/** Parte diario de grupos de un rango: una fila por edición y el resumen por grupo. */
export async function downloadGroupRangeReportPDF(params: {
  from: string;
  to: string;
  editions: (GroupRangeEditionRow & { title: string })[];
  groups: GroupReportRow[];
  totals: GroupReportAmounts;
  /** T�tulo del PDF, con el juego (`pollaDailyReportTitle`). */
  title: string;
  fileName: string;
}) {
  const { doc, autoTable, width } = await newDoc();
  doc.setProperties({ title: params.fileName });

  const startY = header(doc, params.title, [
    `Del ${dayjs(params.from).format('DD/MM/YYYY')} al ${dayjs(params.to).format('DD/MM/YYYY')} (por fecha de liquidación)`,
  ]);

  const body: RowInput[] = params.editions.map((row) => [
    dayjs(row.liquidatedAt).format('DD/MM/YYYY'),
    row.title,
    right(pesos(row.total)),
    right(pesos(row.admin)),
    right(pesos(row.capitalist)),
  ]);
  body.push([
    bold('TOTAL'),
    '',
    bold(pesos(params.totals.total), 'right'),
    bold(pesos(params.totals.admin), 'right'),
    bold(pesos(params.totals.capitalist), 'right'),
  ]);

  const moneyW = 28;
  autoTable(doc, {
    ...gridTableOptions({
      fontSize: FONT - 1,
      cellPadding: 1.5,
      margin: MARGIN,
      width,
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: width - 24 - moneyW * 3 },
        2: { cellWidth: moneyW },
        3: { cellWidth: moneyW },
        4: { cellWidth: moneyW },
      },
    }),
    head: [['Fecha liq.', 'Edición', 'Total', '$ Admin', 'Capitalista']],
    body,
    startY,
  });

  let y = lastTableY(doc, startY) + 10;
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(12);
  doc.text('Resumen por grupo', MARGIN.left, y);
  groupsTable(doc, autoTable, width, y + 4, params.groups, params.totals);

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, params.fileName);
}
