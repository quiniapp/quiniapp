'use client';

import dayjs from 'dayjs';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import {
  getPDFDeps,
  addFooterPageNumbers,
  buildBaseStyles,
  buildTwoColAccountWidths,
  openPDFPrintDialog,
  money,
  BORDER_CELL,
  BORDER_TABLE,
  computeTotals,
} from './pdf-shared';

export async function downloadCurrentAccountTablePDF(params: {
  date?: string | null;
  data: ICurrentAccountEntityFront[];
}) {
  const BASE_FONT = 8;
  const CELL_PAD = 1;
  const MONEY_COL_COUNT = 10;
  const { jsPDF, autoTable } = await getPDFDeps();
  const totals = computeTotals(params.data);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const dateStr = params.date ? dayjs(params.date).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY');
  const dateFile = params.date ? dayjs(params.date).format('DD-MM-YYYY') : dayjs().format('DD-MM-YYYY');

  doc.setProperties({ title: `Exportar_Diario_${dateFile}` });
  doc.setFontSize(14);
  doc.text('Liquidación', 14, 14);
  doc.setFontSize(10);
  doc.text(`Fecha de la Liquidación: ${dateStr}`, 14, 20);
  doc.setFontSize(BASE_FONT);

  const margin = { left: 14, right: 14 };
  const available = doc.internal.pageSize.getWidth() - margin.left - margin.right;
  const minMoneyCol = doc.getTextWidth('-9.999.999,9') + CELL_PAD * 2 + 0.5;
  const { numberColWidth, nameColWidth, moneyColWidth } = buildTwoColAccountWidths(available, minMoneyCol, MONEY_COL_COUNT);

  const columnStyles: Record<number, any> = {
    0: { cellWidth: numberColWidth, halign: 'left', overflow: 'ellipsize' },
    1: { cellWidth: nameColWidth, halign: 'left', overflow: 'ellipsize' },
    ...Object.fromEntries(
      Array.from({ length: MONEY_COL_COUNT }, (_, i) => [i + 2, { cellWidth: moneyColWidth, halign: 'right', overflow: 'hidden' }])
    ),
  };

  const baseStyles = buildBaseStyles(BASE_FONT, CELL_PAD);

  const HEAD = [['Número', 'Nombre', 'Pase', 'Aciertos', 'Reclamos', 'Subtotal', 'Deuda', 'Cobros', 'Pagos', 'Total', 'Arrastre', 'Deje']];
  const HEAD_FOOTER = [['', '', 'Pase', 'Aciertos', 'Reclamos', 'Subtotal', 'Deuda', 'Cobros', 'Pagos', 'Total', 'Arrastre', 'Deje']];

  const body = params.data.map((a) => [
    a.user_number ?? '',
    a.user_name ?? '',
    money(a.pass), money(a.successes), money(a.claims), money(a.subtotal),
    money(a.previous_balance), money(a.collections), money(a.paid),
    money(a.total), money(a.drag), money(a.leave),
  ]);

  const tableOpts = { margin, theme: 'grid', ...BORDER_TABLE, styles: baseStyles, headStyles: { ...BORDER_CELL, halign: 'center', fontSize: BASE_FONT, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, bodyStyles: { ...BORDER_CELL, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, alternateRowStyles: { fillColor: [255, 255, 255] }, columnStyles, tableWidth: available };

  autoTable(doc, { head: HEAD, body, startY: 26, ...tableOpts });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 26;

  const totalsRow = [
    'Totales', '',
    money(totals.pass), money(totals.successes), money(totals.claims), money(totals.subtotal),
    money(totals.previous_balance), money(totals.collections), money(totals.paid),
    money(totals.total), money(totals.drag), money(totals.leave),
  ];

  autoTable(doc, { head: HEAD_FOOTER, body: [totalsRow], startY: finalY + 6, ...tableOpts });

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, `Exportar_Diario_${dateFile}`);
}
