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
} from './pdf-shared';

export async function downloadCurrentAccountGroupSummaryPDF(params: {
  date: string;
  data: ICurrentAccountEntityFront[];
  groupName: string;
}) {
  const BASE_FONT = 8;
  const CELL_PAD = 1;
  const MONEY_COL_COUNT = 10;
  const { jsPDF, autoTable } = await getPDFDeps();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const dateStr = dayjs(params.date).format('DD/MM/YYYY');
  const dateFile = dayjs(params.date).format('DD-MM-YYYY');
  const groupSlug = params.groupName.trim().replace(/\s+/g, '_');

  doc.setProperties({ title: `Resumen_Cuenta_Corriente_${groupSlug}_${dateFile}` });
  doc.setFontSize(14);
  doc.text('Resumen Cuenta Corriente', 14, 14);
  doc.setFontSize(10);
  doc.text(`Fecha: ${dateStr}`, 14, 20);
  doc.text(`Grupo: ${params.groupName}`, 14, 26);
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
  const tableOpts = { margin, theme: 'grid', ...BORDER_TABLE, styles: baseStyles, headStyles: { ...BORDER_CELL, halign: 'center', fontSize: BASE_FONT, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, bodyStyles: { ...BORDER_CELL, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, alternateRowStyles: { fillColor: [255, 255, 255] }, columnStyles, tableWidth: available };

  const HEAD = [['Pasador', 'Nombre', 'Pase', 'Aciertos', 'Reclamos', 'Subtotal', 'Deuda', 'Cobros', 'Pagos', 'Total', 'Arrastre', 'Deje']];

  const body = params.data.map((a) => [
    String(a.user_number ?? ''),
    a.user_name ?? '',
    money(a.pass), money(a.successes), money(a.claims), money(a.subtotal),
    money(a.previous_balance), money(a.collections), money(a.paid),
    money(a.total), money(a.drag), money(a.leave),
  ]);

  autoTable(doc, { head: HEAD, body, startY: 32, ...tableOpts });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 32;

  const totalsRow = [
    'Totales', '',
    money(params.data.reduce((s, a) => s + (a.pass ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.successes ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.claims ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.subtotal ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.previous_balance ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.collections ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.paid ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.total ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.drag ?? 0), 0)),
    money(params.data.reduce((s, a) => s + (a.leave ?? 0), 0)),
  ];

  autoTable(doc, { head: [['', '', 'Pase', 'Aciertos', 'Reclamos', 'Subtotal', 'Deuda', 'Cobros', 'Pagos', 'Total', 'Arrastre', 'Deje']], body: [totalsRow], startY: finalY + 6, ...tableOpts });

  addFooterPageNumbers(doc);
  openPDFPrintDialog(doc, `Resumen_Cuenta_Corriente_${groupSlug}_${dateFile}`);
}
