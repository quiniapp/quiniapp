'use client';

import dayjs from 'dayjs';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
const BASE_LINE = 0.15; // probá 0.15–0.2 hasta que lo veas igual
const BORDER_CELL = { lineWidth: BASE_LINE, lineColor: [0, 0, 0] as [number, number, number] };
const BORDER_TABLE = {
  tableLineWidth: BASE_LINE,
  tableLineColor: [0, 0, 0] as [number, number, number],
};

const money = (n: number) => `$ ${n}`;

/** Evita problemas con SSR cargando jsPDF/autotable sólo en el cliente */
async function getPDFDeps() {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default as any;
  return { jsPDF, autoTable };
}

function addFooterPageNumbers(doc: any) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
}

/** PDF con la tabla completa + totales */
export async function downloadCurrentAccountTablePDF(params: {
  date?: string | null;
  data: ICurrentAccountEntityFront[];
}) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const totals = computeTotals(params.data);

  // 👉 landscape
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const dateStr = params?.date
    ? dayjs(params.date).format('DD/MM/YYYY')
    : dayjs().format('DD/MM/YYYY');

  // Encabezado
  doc.setFontSize(14);
  doc.text('Liquidación', 14, 14);
  doc.setFontSize(10);
  doc.text(`Fecha de la Liquidación: ${dateStr}`, 14, 20);

  // 👉 Definimos mismos márgenes y anchos fijos por columna (alineación garantizada)
  const margin = { left: 14, right: 14 };
  const pageWidth = doc.internal.pageSize.getWidth();
  const available = pageWidth - margin.left - margin.right;

  // pesos relativos por columna (Nombre más ancho)
  const weights = [0.9, 2.8, 1.1, 1.2, 1.1, 1.1, 1.2, 1.1, 1.1, 1.2, 1.2, 1.0];
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sum) * available);

  const columnStyles = widths.reduce<Record<number, any>>((acc, w, i) => {
    acc[i] = { cellWidth: w, halign: i <= 1 ? 'left' : 'right' }; // 0=Numero, 1=Nombre
    return acc;
  }, {});

  // 👉 HEAD en el orden pedido
  const HEAD = [
    [
      'Número',
      'Nombre',
      'Pase',
      'Subtotal',
      'Aciertos',
      'Reclamos',
      'Deuda',
      'Cobros',
      'Pagos',
      'Total',
      'Arrastre',
      'Deje',
    ],
  ];

  const HEAD_FOOTER = [
    [
      '',
      '',
      'Pase',
      'Subtotal',
      'Aciertos',
      'Reclamos',
      'Deuda',
      'Cobros',
      'Pagos',
      'Total',
      'Arrastre',
      'Deje',
    ],
  ];
  // 👉 BODY en el mismo orden
  const body = params.data.map((a) => [
    a.user_number ?? '',
    a.user_name ?? '',
    money(a.pass),
    money(a.subtotal),
    money(a.successes),
    money(a.claims),
    money(a.previous_balance),
    money(a.collections),
    money(a.paid),
    money(a.total),
    money(a.drag),
    money(a.leave),
  ]);

  // Tabla principal
  autoTable(doc, {
    head: HEAD,
    body,
    startY: 26,
    margin,
    theme: 'grid',

    // 👉 borde exterior de la tabla = igual que celdas
    ...BORDER_TABLE,

    styles: {
      ...BORDER_CELL,
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    headStyles: {
      ...BORDER_CELL, // 👉 header con el mismo borde que las celdas
      halign: 'center',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    bodyStyles: {
      ...BORDER_CELL,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles,
    tableWidth: available,
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 26;

  // Footer: mismos headers + una fila de totales con mismos anchos/margen
  const totalsRow = [
    'Totales', // Número
    '', // Nombre
    money(totals.pass),
    money(totals.subtotal),
    money(totals.successes),
    money(totals.claims),
    money(totals.previous_balance),
    money(totals.collections),
    money(totals.paid),
    money(totals.total),
    money(totals.drag),
    money(totals.leave),
  ];

  autoTable(doc, {
    startY: finalY + 6,
    head: HEAD_FOOTER,
    body: [totalsRow],
    margin,

    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles,
    tableWidth: available,
    theme: 'grid',

    // 👉 borde exterior de la tabla = igual que celdas
    ...BORDER_TABLE,

    styles: {
      ...BORDER_CELL,
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    headStyles: {
      ...BORDER_CELL, // 👉 header con el mismo borde que las celdas
      halign: 'center',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    bodyStyles: {
      ...BORDER_CELL,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
  });

  addFooterPageNumbers(doc);
  doc.save(`Liquidacion_${dateStr}.pdf`);
}

/** PDF de una sola cuenta/usuario (ideal para disparar desde el modal) */
export async function printDiaryLiquidationAdmin(params: {
  date?: string | null;
  account: ICurrentAccountEntityFront;
}) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const dateStr = params?.date
    ? dayjs(params.date).format('DD/MM/YYYY')
    : dayjs().format('DD/MM/YYYY');

  doc.setFontSize(14);
  doc.text('Liquidación por Usuario', 14, 14);
  doc.setFontSize(10);
  doc.text(`Fecha de la Liquidación: ${dateStr}`, 14, 20);
  doc.text(`Nº: ${params.account.user_number ?? ''}`, 14, 26);
  doc.text(`Nombre: ${params.account.user_name ?? ''}`, 14, 32);

  const rows = [
    ['Pase', money(params.account.pass)],
    ['Subtotal', money(params.account.subtotal)],
    ['Aciertos', money(params.account.successes)],
    ['Reclamos', money(params.account.claims)],
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
    {
      pass: 0,
      successes: 0,
      claims: 0,
      subtotal: 0,
      previous_balance: 0,
      collections: 0,
      paid: 0,
      total: 0,
      drag: 0,
      leave: 0,
    }
  );
