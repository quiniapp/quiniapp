'use client';

import dayjs from 'dayjs';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { getPDFDeps, addFooterPageNumbers, money } from './pdf-shared';

export async function printDiaryLiquidationAdmin(params: {
  date?: string | null;
  account: ICurrentAccountEntityFront;
}) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const dateStr = params.date ? dayjs(params.date).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY');

  doc.setFontSize(14);
  doc.text('Liquidación por Usuario', 14, 14);
  doc.setFontSize(10);
  doc.text(`Fecha de la Liquidación: ${dateStr}`, 14, 20);
  doc.text(`Nº: ${params.account.user_number ?? ''}`, 14, 26);
  doc.text(`Nombre: ${params.account.user_name ?? ''}`, 14, 32);

  const rows = [
    ['Pase', money(params.account.pass)],
    ['Aciertos', money(params.account.successes)],
    ['Reclamos', money(params.account.claims)],
    ['Subtotal', money(params.account.subtotal)],
    ['Deuda', money(params.account.bills)],
    ['Cobros', money(params.account.collections)],
    ['Pagos', money(params.account.paid)],
    ['Arrastre', money(params.account.drag)],
    ['Deje', money(params.account.leave)],
    ['TOTAL', money(params.account.total)],
  ];

  autoTable(doc, {
    startY: 40,
    head: [['Concepto', 'Importe']],
    body: rows,
    styles: { fontSize: 11, cellPadding: 3, halign: 'right' },
    headStyles: { halign: 'center' },
    columnStyles: { 0: { halign: 'left' } },
  });

  addFooterPageNumbers(doc);
  doc.save(`LiquidacionGeneral-${dateStr}.pdf`);
}
