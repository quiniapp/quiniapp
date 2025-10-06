'use client';

import dayjs from 'dayjs';
import type { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import type { IBetEntityFront } from '@helper/types/bet.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';

const money = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

async function getPDFDeps() {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default as any;
  return { jsPDF, autoTable };
}

export async function printUserSlipPDF(opts: {
  account: ICurrentAccountEntityFront;
  date?: string | null;
  bets?: IBetEntityFront[];
}) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const { account } = opts;
  const bets = opts.bets ?? [];

  // 👉 horizontal
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const margin = { left: 14, right: 14 };
  const pageW = doc.internal.pageSize.getWidth();
  const usableW = pageW - margin.left - margin.right;
  const col3 = usableW / 3;

  const dateStr = opts.date
    ? dayjs(opts.date).format('D/M/YYYY')
    : account?.date
      ? dayjs(account.date).format('D/M/YYYY')
      : dayjs().format('D/M/YYYY');

  // ===== Encabezado (3 columnas en una línea) =====
  doc.setFontSize(11);
  doc.text(`Nro: ${account.user_number ?? ''}`, margin.left, 14);
  doc.text(`Nombre: ${account.user_name ?? ''}`, margin.left + usableW / 2, 14, {
    align: 'center',
  });
  doc.text(`Fecha ${dateStr}`, margin.left + usableW, 14, { align: 'right' });

  // Separador
  doc.line(margin.left, 18, margin.left + usableW, 18);

  // ===== Bloque 3x4 =====
  const block1Rows = [
    [
      `Pase: ${money(account.pass)}`,
      `Subtotal: ${money(account.subtotal)}`,
      `Deja: ${money(account.revenue)}`,
    ],
    [
      `Comision: ${money(account.cashier_commission)}`,
      `Saldo: ${money(account.previous_balance)}`,
      `Gastos: ${money(account.bills)}`,
    ],
    [`Aciertos: ${money(account.successes)}`, `Pague: ${money(account.paid)}`, ''],
    [`Reclamos: ${money(account.claims)}`, `Cobre: ${money(account.collections)}`, account?.leave?`Deje: ${account.leave}`:''],
  ];

  autoTable(doc, {
    startY: 22,
    body: block1Rows,
    theme: 'grid',
    margin,
    styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
    columnStyles: {
      0: { cellWidth: col3 },
      1: { cellWidth: col3 },
      2: { cellWidth: col3 },
    },
    tableWidth: usableW,
  });

  let y = (doc as any).lastAutoTable?.finalY ?? 22;

  // Separador
  doc.line(margin.left, y + 4, margin.left + usableW, y + 4);

  // ===== Bloque "Deja | Subtotal | Debe" (1 fila, 3 columnas) =====
  const block2Row = [
    [
      `Deja: ${money(account.revenue)}`,
      `Subtotal: ${money(account.subtotal)}`,
      `Debe: ${money(account.total)}`, // si preferís otro cálculo, reemplazá por el valor correcto
    ],
  ];

  autoTable(doc, {
    startY: y + 8,
    body: block2Row,
    theme: 'grid',
    margin,
    styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
    columnStyles: {
      0: { cellWidth: col3 },
      1: { cellWidth: col3 },
      2: { cellWidth: col3 },
    },
    tableWidth: usableW,
  });

  y = (doc as any).lastAutoTable?.finalY ?? y;

  // Separador
  doc.line(margin.left, y + 4, margin.left + usableW, y + 4);

  // ===== Título "Aciertos" =====
  doc.setFontSize(11);
  doc.text('Aciertos', margin.left, y + 10);

  // ===== Tabla de aciertos =====
  const head = [['Jugada', 'Tipo', 'Monto', 'Quiniela', 'Turno', 'Aciertos', 'Premio']];
  const body = bets.map((b) => [
    String(b.number ?? ''),
    String(betPlaceDictionary[b.place] ?? ''),
    money(b.amount),
    String(b.lottery?.name ?? ''),
    String(b.schedule?.name ?? ''),
    String(b.hits ?? 0),
    money(b.prize),
  ]);

  // pesos → anchos proporcionales similares a la imagen
  const w = [1.6, 1.2, 0.9, 1.2, 0.8, 0.9, 1.0];
  const sumW = w.reduce((a, c) => a + c, 0);
  const widths = w.map((x) => (x / sumW) * usableW);

  autoTable(doc, {
    startY: y + 14,
    head,
    body,
    theme: 'grid',
    margin,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: {
      halign: 'center',
      fillColor: [255, 255, 255], // header blanco
      textColor: [0, 0, 0], // header en negro
    },
    columnStyles: {
      0: { cellWidth: widths[0], halign: 'left' },
      1: { cellWidth: widths[1], halign: 'left' },
      2: { cellWidth: widths[2], halign: 'right' },
      3: { cellWidth: widths[3], halign: 'left' },
      4: { cellWidth: widths[4], halign: 'left' },
      5: { cellWidth: widths[5], halign: 'right' },
      6: { cellWidth: widths[6], halign: 'right' },
    },
    tableWidth: usableW,
  });

  // Footer páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Página ${i} de ${pages}`,
      margin.left + usableW,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' }
    );
  }

  doc.save(`Liquidacion-${dateStr}--${account.user_name}-${account.user_number}.pdf`);
}
