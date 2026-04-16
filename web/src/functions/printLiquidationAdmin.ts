'use client';

import dayjs from 'dayjs';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
const BASE_LINE = 0.15; // probá 0.15–0.2 hasta que lo veas igual
const BORDER_CELL = { lineWidth: BASE_LINE, lineColor: [0, 0, 0] as [number, number, number] };
const BORDER_TABLE = {
  tableLineWidth: BASE_LINE,
  tableLineColor: [0, 0, 0] as [number, number, number],
};

const money = (n: number) => {
  const fmt = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1, // ⬅️ 1 decimal
  });
  return fmt.format(Number.isFinite(n) ? n : 0); // ⬅️ sin $
};

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
  const BASE_FONT = 8; // antes 9
  const CELL_PAD = 1; // antes 2.0
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

  // 2) dentro de downloadCurrentAccountTablePDF, después de crear el doc:

  // 👉 Márgenes y medidas base
// --- medidas base (seguí usando landscape A4 en mm)
// const BASE_FONT = 8.5;
// const CELL_PAD = 1.6;
doc.setFontSize(BASE_FONT);

const margin = { left: 14, right: 14 };       // si hace falta más lugar, podés bajar a 12/12
const pageWidth = doc.internal.pageSize.getWidth();
const available = pageWidth - margin.left - margin.right;

// peor caso garantizado: 7 dígitos + 1 decimal + separadores + posible signo
const worstMoney = '-9.999.999,9';
const MONEY_W_TEXT = doc.getTextWidth(worstMoney);
const minMoneyCol = MONEY_W_TEXT + CELL_PAD * 2 + 0.5; // ancho mínimo numérico

const numberColWidth = 16;             // "Número" angosto y fijo
const MONEY_COL_COUNT = 10;            // Pase, Subtotal, Aciertos, Reclamos, Deuda, Cobros, Pagos, Total, Arrastre, Deje

// 1) Partimos del mínimo que entra seguro para cada numérica
let moneyColWidth = Math.ceil(minMoneyCol);

// 2) Asignamos a "Nombre" un ancho inicial más chico (achicamos esta col)
const MIN_NAME = 24;                   // ⬅️ ANTES era 30/32, ahora la achicamos
let nameColWidth = MIN_NAME;

// 3) Calculamos el espacio usado y el remanente
let used = numberColWidth + nameColWidth + moneyColWidth * MONEY_COL_COUNT;
let leftover = available - used;

// Si sobra ancho, lo repartimos entre TODAS las numéricas por igual
if (leftover > 0) {
  const addEach = leftover / MONEY_COL_COUNT;
  moneyColWidth = Math.floor(moneyColWidth + addEach); // puede ser float, pero redondeo a piso para evitar overrun
  // recalculamos con el nuevo ancho
  used = numberColWidth + nameColWidth + moneyColWidth * MONEY_COL_COUNT;
  leftover = available - used;
  // Si quedó 1–2mm sueltos por redondeo, sumalos a "Nombre" como colchón
  if (leftover > 0) nameColWidth += leftover;
} else {
  // Si falta espacio (no debería, pero por si cambiaste márgenes/fuente)
  // reducimos 0.5mm a cada numérica sin bajar del mínimo medido
  const deficit = -leftover;
  const reduceEach = Math.ceil(deficit / MONEY_COL_COUNT);
  moneyColWidth = Math.max(Math.ceil(minMoneyCol), moneyColWidth - reduceEach);
  // y recomputamos
  used = numberColWidth + nameColWidth + moneyColWidth * MONEY_COL_COUNT;
  nameColWidth = Math.max(MIN_NAME, available - numberColWidth - moneyColWidth * MONEY_COL_COUNT);
}

// 4) columnStyles (se aplican IGUAL a la tabla principal y al footer)
const columnStyles: Record<number, any> = {
  0:  { cellWidth: numberColWidth, halign: 'left',  overflow: 'ellipsize' }, // Número
  1:  { cellWidth: nameColWidth,   halign: 'left',  overflow: 'ellipsize' }, // Nombre
  2:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Pase
  3:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Subtotal
  4:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Aciertos
  5:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Reclamos
  6:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Deuda
  7:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Cobros
  8:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Pagos
  9:  { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Total
  10: { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Arrastre
  11: { cellWidth: moneyColWidth,  halign: 'right', overflow: 'hidden' },    // Deje
};

// usa el MISMO font/padding/columnStyles en ambos autoTable
const baseStyles = {
  ...BORDER_CELL,
  fontSize: BASE_FONT,
  cellPadding: CELL_PAD,
  overflow: 'linebreak',
  fillColor: [255, 255, 255],
  textColor: [0, 0, 0],
};
  // 👉 HEAD en el orden pedido
  const HEAD = [
    [
      'Número',
      'Nombre',
      'Pase',
      'Aciertos',
      'Reclamos',
      'Subtotal',
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
      'Aciertos',
      'Reclamos',
      'Subtotal',
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
    money(a.successes),
    money(a.claims),
    money(a.subtotal),
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
    ...BORDER_TABLE,
    styles: baseStyles,
    headStyles: {
      ...BORDER_CELL,
      halign: 'center',
      fontSize: BASE_FONT,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    bodyStyles: { ...BORDER_CELL, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
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
    money(totals.successes),
    money(totals.claims),
    money(totals.subtotal),
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
    theme: 'grid',
    ...BORDER_TABLE,
    styles: baseStyles,
    headStyles: {
      ...BORDER_CELL,
      halign: 'center',
      fontSize: BASE_FONT,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    bodyStyles: { ...BORDER_CELL, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles,
    tableWidth: available,
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
