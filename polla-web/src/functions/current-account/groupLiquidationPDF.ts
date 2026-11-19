import dayjs from 'dayjs';
import { liquidationZipEntries } from '@helper/functions/liquidationZip';
import type { CellInput } from 'jspdf-autotable';
import {
  GroupLiquidationAccount,
  groupLiquidationLabel,
  groupLiquidationRows,
} from '@/lib/groupLiquidation';
import { groupLiquidationFileName, zipFiles, zipRootFolder } from '@/lib/liquidationZip';
import { downloadPdfBlob, shareFile } from '../printPdf';
import { PdfDoc, addFooterPageNumbers, getPDFDeps, gridTableOptions } from './pdf-shared';

/**
 * Hoja de liquidación de un grupo en una edición (A4 vertical, una por grupo):
 * lo que dejaron los pasadores, los gastos, el total y lo que va al admin y al
 * capitalista. Al liquidar se bajan todas juntas en un ZIP.
 */

const FONT = 11;
const MARGIN = { left: 14, right: 14 };

export interface GroupLiquidationSheet {
  account: GroupLiquidationAccount;
  group: { number?: number; name: string };
  orgName: string;
  editionTitle: string;
  /** `YYYY-MM-DD`: la de la liquidación más nueva de las que se exportan. */
  date: string;
}

/** Hoja de un grupo: encabezado con organización y edición, y la tabla de renglones. */
export async function buildGroupLiquidationPDF(sheet: GroupLiquidationSheet) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN.left - MARGIN.right;

  doc.setProperties({ title: groupLiquidationFileName(sheet.group, sheet.date, 'pdf') });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sheet.orgName, MARGIN.left, 16);
  doc.text(`Edición ${sheet.editionTitle}`, pageWidth - MARGIN.right, 16, { align: 'right' });
  doc.setFontSize(12);
  doc.text(`Liquidación ${groupLiquidationLabel(sheet.group)}`, MARGIN.left, 24);
  doc.text(dayjs(sheet.date).format('DD/MM/YYYY'), pageWidth - MARGIN.right, 24, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');

  const body: CellInput[][] = groupLiquidationRows(sheet.account).map((row) => [
    row.label,
    { content: row.value, styles: { halign: 'right' } },
  ]);
  autoTable(doc, {
    ...gridTableOptions({
      fontSize: FONT,
      cellPadding: 2,
      margin: MARGIN,
      width,
      columnStyles: { 0: { cellWidth: width - 50 }, 1: { cellWidth: 50 } },
    }),
    body,
    startY: 32,
  });

  addFooterPageNumbers(doc);
  return doc;
}

/**
 * Ruta de cada hoja dentro del ZIP: `raíz/Grupo N - Nombre DD-MM-YYYY.ext`, sin
 * carpetas por grupo. Ordenadas por número de grupo; las sin número, al final.
 */
export const groupLiquidationZipEntries = (
  sheets: GroupLiquidationSheet[],
  zipName: string,
  ext: 'pdf' | 'png'
) => {
  const byNumber = [...sheets].sort(
    (a, b) =>
      (a.group.number ?? Number.POSITIVE_INFINITY) - (b.group.number ?? Number.POSITIVE_INFINITY)
  );
  return liquidationZipEntries(
    byNumber.map((sheet) => ({
      sheet,
      fileName: groupLiquidationFileName(sheet.group, sheet.date, ext),
    })),
    zipRootFolder(zipName)
  ).map(({ path, item }) => ({ path, item: item.sheet }));
};

/**
 * ZIP con un PDF por grupo: en el celular se comparte, en la computadora se
 * descarga. Devuelve false si no hay hojas (no arma un ZIP vacío).
 */
export async function exportGroupLiquidationsZip(params: {
  sheets: GroupLiquidationSheet[];
  zipName: string;
}) {
  if (params.sheets.length === 0) return false;

  const entries = groupLiquidationZipEntries(params.sheets, params.zipName, 'pdf');
  const files: { path: string; data: Uint8Array }[] = [];
  for (const [index, { path, item }] of entries.entries()) {
    // Cede el hilo para que se pinte "Exportando…" en exportes grandes.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const doc = await buildGroupLiquidationPDF(item);
    files.push({ path, data: new Uint8Array(doc.output('arraybuffer')) });
  }

  const blob = await zipFiles(files);
  await shareFile(blob, params.zipName, 'Liquidaciones de grupos', 'application/zip');
  return true;
}

/** Una sola hoja: baja el PDF suelto, sin ZIP. */
export async function downloadGroupLiquidationPDF(sheet: GroupLiquidationSheet) {
  const doc = await buildGroupLiquidationPDF(sheet);
  downloadPdfBlob(doc.output('blob'), groupLiquidationFileName(sheet.group, sheet.date, 'pdf'));
}
