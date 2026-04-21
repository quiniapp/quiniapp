'use client';

import dayjs from 'dayjs';
import type { DailySummaryEntry } from '@/hooks/fetchs/current-account/useGetCurrentAccountDailySummary';
import {
  getPDFDeps,
  addFooterPageNumbers,
  buildBaseStyles,
  buildDateColAccountWidths,
  openPDFPrintDialog,
  money,
  BORDER_CELL,
  BORDER_TABLE,
} from './pdf-shared';

export async function downloadCurrentAccountDailySummaryPDF(params: {
  date_from: string;
  date_to: string;
  data: DailySummaryEntry[];
  groupName?: string;
}) {
  const BASE_FONT = 8;
  const CELL_PAD = 1;
  const MONEY_COL_COUNT = 10;
  const { jsPDF, autoTable } = await getPDFDeps();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const fromStr = dayjs(params.date_from).format('DD/MM/YYYY');
  const toStr = dayjs(params.date_to).format('DD/MM/YYYY');
  const fromFile = dayjs(params.date_from).format('DD-MM-YYYY');
  const toFile = dayjs(params.date_to).format('DD-MM-YYYY');
  const groupSlug = params.groupName ? `_${params.groupName.trim().replace(/\s+/g, '_')}` : '';

  doc.setProperties({ title: `Resumen_Cuenta_Corriente${groupSlug}_${fromFile}_${toFile}` });
  doc.setFontSize(14);
  doc.text('Resumen Cuenta Corriente', 14, 14);
  doc.setFontSize(10);
  doc.text(`Período: ${fromStr} al ${toStr}`, 14, 20);
  const headerEndY = params.groupName ? 32 : 26;
  if (params.groupName) doc.text(`Grupo: ${params.groupName}`, 14, 26);
  doc.setFontSize(BASE_FONT);

  const margin = { left: 14, right: 14 };
  const available = doc.internal.pageSize.getWidth() - margin.left - margin.right;
  const minMoneyCol = doc.getTextWidth('-9.999.999,9') + CELL_PAD * 2 + 0.5;
  const { dateColWidth, moneyColWidth } = buildDateColAccountWidths(available, minMoneyCol, MONEY_COL_COUNT);

  const columnStyles: Record<number, any> = {
    0: { cellWidth: dateColWidth, halign: 'left', overflow: 'ellipsize' },
    ...Object.fromEntries(
      Array.from({ length: MONEY_COL_COUNT }, (_, i) => [i + 1, { cellWidth: moneyColWidth, halign: 'right', overflow: 'hidden' }])
    ),
  };

  const baseStyles = buildBaseStyles(BASE_FONT, CELL_PAD);
  const tableOpts = { margin, theme: 'grid', ...BORDER_TABLE, styles: baseStyles, headStyles: { ...BORDER_CELL, halign: 'center', fontSize: BASE_FONT, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, bodyStyles: { ...BORDER_CELL, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, alternateRowStyles: { fillColor: [255, 255, 255] }, columnStyles, tableWidth: available };

  const HEAD = [['Fecha', 'Pase', 'Aciertos', 'Reclamos', 'Subtotal', 'Deuda', 'Cobros', 'Pagos', 'Total', 'Arrastre', 'Deje']];

  const body = params.data.map((d) => [
    dayjs(d.date).format('DD/MM/YYYY'),
    money(d.total_pass), money(d.total_successes), money(d.total_claims), money(d.total_subtotal),
    money(d.total_previous_balance), money(d.total_collections), money(d.total_paid),
    money(d.total_total), money(d.total_drag), money(d.total_leave),
  ]);

  autoTable(doc, { head: HEAD, body, startY: headerEndY, ...tableOpts });

  const finalY = (doc as any).lastAutoTable?.finalY ?? headerEndY;

  const totalsRow = [
    'Totales',
    money(params.data.reduce((s, d) => s + d.total_pass, 0)),
    money(params.data.reduce((s, d) => s + d.total_successes, 0)),
    money(params.data.reduce((s, d) => s + d.total_claims, 0)),
    money(params.data.reduce((s, d) => s + d.total_subtotal, 0)),
    money(params.data.reduce((s, d) => s + d.total_previous_balance, 0)),
    money(params.data.reduce((s, d) => s + d.total_collections, 0)),
    money(params.data.reduce((s, d) => s + d.total_paid, 0)),
    money(params.data.reduce((s, d) => s + d.total_total, 0)),
    money(params.data.reduce((s, d) => s + d.total_drag, 0)),
    money(params.data.reduce((s, d) => s + d.total_leave, 0)),
  ];

  autoTable(doc, { head: [['', 'Pase', 'Aciertos', 'Reclamos', 'Subtotal', 'Deuda', 'Cobros', 'Pagos', 'Total', 'Arrastre', 'Deje']], body: [totalsRow], startY: finalY + 6, ...tableOpts });

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, `Resumen_Cuenta_Corriente${groupSlug}_${fromFile}_${toFile}`);
}
