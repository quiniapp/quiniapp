import dayjs from 'dayjs';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { DailyTotalEntry } from '@/hooks/fetchs/current-account/useGetCurrentAccountTotals';
import { DailySummaryEntry } from '@/hooks/fetchs/current-account/useGetCurrentAccountDailySummary';
import { printPdfBlob } from './makeTicket';

const PAPER_W = 58;
const CHARS = 32;
const NUM_COL = 5; // max 5-digit user numbers
const MARGIN = 3;
const FONT_SIZE = 8;
const LINE_H = 4;

async function getPDFDeps() {
  const { default: jsPDF } = await import('jspdf');
  return { jsPDF };
}

const money = (n: number) =>
  '$' +
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );

function padLine(label: string, amount: string): string {
  const spaces = CHARS - label.length - amount.length;
  return label + ' '.repeat(Math.max(1, spaces)) + amount;
}

function centerLine(text: string): string {
  const pad = Math.max(0, Math.floor((CHARS - text.length) / 2));
  return ' '.repeat(pad) + text;
}

const DIVIDER = '- '.repeat(CHARS / 2);

const fileSlug = (s?: string) => s ? `_${s.trim().replace(/\s+/g, '_')}` : '';

export async function printDailyTotalsTicket(params: {
  data: ICurrentAccountEntityFront[];
  date: string;
  orgName: string;
  groupName?: string;
  expenses: { nombre: string; monto: number }[];
}) {
  const { data, date, orgName, groupName, expenses } = params;
  const { jsPDF } = await getPDFDeps();

  const mePago = data.filter((a) => (a.collections ?? 0) > 0);
  const lePago = data.filter((a) => (a.paid ?? 0) > 0);
  const totalCollections = mePago.reduce((s, a) => s + (a.collections ?? 0), 0);
  const totalPaid = lePago.reduce((s, a) => s + (a.paid ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.monto ?? 0), 0);
  const saldoDia = totalCollections - totalPaid - totalExpenses;

  const dateStr = dayjs(date).format('DD/MM/YYYY');
  const dateFile = dayjs(date).format('DD-MM-YYYY');
  const timeStr = dayjs().format('HH:mm');

  const lines: string[] = [];

  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  if (groupName) lines.push(centerLine(groupName.toUpperCase()));
  lines.push(centerLine('ENTRADA Y SALIDA DEL DIA'));
  lines.push(centerLine(`FECHA: ${dateStr} ${timeStr}`));
  lines.push(DIVIDER);
  lines.push(padLine('Nro'.padEnd(NUM_COL) + ' Detalle', 'Importe'));
  lines.push(DIVIDER);

  if (mePago.length > 0) {
    for (const acc of mePago) {
      lines.push(padLine(`${String(acc.user_number).padEnd(NUM_COL)} Pago`, money(acc.collections ?? 0)));
    }
    lines.push(padLine('Subtotal Entradas:', money(totalCollections)));
    lines.push(DIVIDER);
  }

  if (lePago.length > 0) {
    for (const acc of lePago) {
      lines.push(padLine(`${String(acc.user_number).padEnd(NUM_COL)} Pague`, money(acc.paid ?? 0)));
    }
    lines.push(padLine('Subtotal Salidas:', money(totalPaid)));
    lines.push(DIVIDER);
  }

  if (expenses.length > 0) {
    for (const exp of expenses) {
      lines.push(padLine(exp.nombre, money(exp.monto)));
    }
  }
  lines.push(padLine('Subtotal Gastos:', money(totalExpenses)));
  lines.push(DIVIDER);
  lines.push(padLine('SALDO DEL DIA:', money(saldoDia)));

  // Extra padding — same pattern as makeTicket.ts to flush printer buffer
  lines.push(DIVIDER);
  lines.push(DIVIDER);
  lines.push(DIVIDER);

  const docHeight = Math.max(80, lines.length * LINE_H + MARGIN * 2 + 4);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAPER_W, docHeight],
  });

  doc.setProperties({ title: `Exportar_Cobros_y_Pagos${fileSlug(groupName)}_${dateFile}` });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = MARGIN + 4;
  for (const line of lines) {
    doc.text(line, MARGIN, y);
    y += LINE_H;
  }

  printPdfBlob(doc.output('blob'));
}

export async function printRangeTotalsTicket(params: {
  dailyTotals: DailyTotalEntry[];
  date_from: string;
  date_to: string;
  percentage: number;
  orgName: string;
  groupName?: string;
}) {
  const { dailyTotals, date_from, date_to, percentage, orgName, groupName } = params;
  const { jsPDF } = await getPDFDeps();

  const grandTotal = dailyTotals.reduce((s, d) => s + d.net_balance, 0);
  const isGana = grandTotal < 0;
  const percentageAmount = (grandTotal * percentage) / 100;

  const fromStr = dayjs(date_from).format('DD/MM/YYYY');
  const toStr = dayjs(date_to).format('DD/MM/YYYY');
  const fromFile = dayjs(date_from).format('DD-MM-YYYY');
  const toFile = dayjs(date_to).format('DD-MM-YYYY');
  const timeStr = dayjs().format('HH:mm');

  const lines: string[] = [];

  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  if (groupName) lines.push(centerLine(groupName.toUpperCase()));
  lines.push(centerLine('BALANCE DE ENTRADA-SALIDA'));
  lines.push(centerLine(`${fromStr} AL ${toStr}`));
  lines.push(centerLine(`HORA: ${timeStr}`));
  lines.push(DIVIDER);

  // Column headers — "Fecha" aligns with DD/MM/YY (8), "Resultado" at pos 9, "Plata" right
  lines.push(padLine('Fecha'.padEnd(9) + 'Resultado', 'Plata'));
  lines.push(DIVIDER);

  for (const entry of dailyTotals) {
    const dateLabel = dayjs(entry.date).format('DD/MM/YY'); // 8 chars
    const neg = entry.net_balance < 0;
    const result = neg ? 'Gana:' : 'Deja:';
    const amount = money(entry.net_balance);
    lines.push(padLine(`${dateLabel} ${result}`, amount));
  }

  lines.push(DIVIDER);
  lines.push('Ud a la fecha');
  lines.push(padLine('', `${isGana ? 'GANA' : 'DEJA'}  ${money(grandTotal)}`));
  if (!isGana) {
    lines.push(DIVIDER);
    lines.push(padLine(`${percentage}% DEJA:`, money(percentageAmount)));
  }

  // Extra padding — flush printer buffer
  lines.push(DIVIDER);
  lines.push(DIVIDER);
  lines.push(DIVIDER);

  const docHeight = Math.max(80, lines.length * LINE_H + MARGIN * 2 + 4);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAPER_W, docHeight],
  });

  doc.setProperties({ title: `Exportar_Cobros_y_Pagos${fileSlug(groupName)}_${fromFile}_${toFile}` });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = MARGIN + 4;
  for (const line of lines) {
    doc.text(line, MARGIN, y);
    y += LINE_H;
  }

  printPdfBlob(doc.output('blob'));
}

export async function printSubtotalsDayTicket(params: {
  data: ICurrentAccountEntityFront[];
  date: string;
  orgName: string;
  groupName?: string;
  expenses?: { nombre: string; monto: number }[];
  percentage?: number;
}) {
  const { data, date, orgName, groupName, expenses = [], percentage } = params;
  const { jsPDF } = await getPDFDeps();

  const dateStr = dayjs(date).format('DD/MM/YYYY');
  const dateFile = dayjs(date).format('DD-MM-YYYY');
  const timeStr = dayjs().format('HH:mm');
  const grandTotal = data.reduce((s, a) => s + (a.subtotal ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.monto ?? 0), 0);
  const saldoNeto = grandTotal - totalExpenses;

  const lines: string[] = [];

  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  if (groupName) lines.push(centerLine(groupName.toUpperCase()));
  lines.push(centerLine('SUBTOTALES DEL DIA'));
  lines.push(centerLine(`FECHA: ${dateStr} ${timeStr}`));
  lines.push(DIVIDER);
  lines.push(padLine('Nro'.padEnd(NUM_COL) + ' Nombre', 'Subtotal'));
  lines.push(DIVIDER);

  for (const acc of data) {
    const label = `${String(acc.user_number).padEnd(NUM_COL)} ${(acc.user_name ?? '').substring(0, 14)}`;
    lines.push(padLine(label, money(acc.subtotal ?? 0)));
  }

  lines.push(DIVIDER);
  lines.push(padLine('TOTAL:', money(grandTotal)));

  if (expenses.length > 0) {
    lines.push(DIVIDER);
    for (const exp of expenses) {
      lines.push(padLine(exp.nombre, money(exp.monto)));
    }
    lines.push(padLine('Total Gastos:', money(totalExpenses)));
    lines.push(DIVIDER);
    lines.push(padLine('SALDO NETO:', money(saldoNeto)));
    if (percentage && percentage > 0) {
      const capitalistaAmount = (saldoNeto * percentage) / 100;
      lines.push(padLine(`${percentage}% CAPITALISTA:`, money(capitalistaAmount)));
    }
  } else if (percentage && percentage > 0) {
    const capitalistaAmount = (grandTotal * percentage) / 100;
    lines.push(DIVIDER);
    lines.push(padLine(`${percentage}% CAPITALISTA:`, money(capitalistaAmount)));
  }

  lines.push(DIVIDER);
  lines.push(DIVIDER);
  lines.push(DIVIDER);

  const docHeight = Math.max(80, lines.length * LINE_H + MARGIN * 2 + 4);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAPER_W, docHeight] });
  doc.setProperties({ title: `Exportar_Subtotales${fileSlug(groupName)}_${dateFile}` });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = MARGIN + 4;
  for (const line of lines) {
    doc.text(line, MARGIN, y);
    y += LINE_H;
  }

  printPdfBlob(doc.output('blob'));
}

export async function printSubtotalsRangeTicket(params: {
  dailySummary: DailySummaryEntry[];
  date_from: string;
  date_to: string;
  orgName: string;
  groupName?: string;
  percentage?: number;
}) {
  const { dailySummary, date_from, date_to, orgName, groupName, percentage } = params;
  const { jsPDF } = await getPDFDeps();

  const fromStr = dayjs(date_from).format('DD/MM/YYYY');
  const toStr = dayjs(date_to).format('DD/MM/YYYY');
  const fromFile = dayjs(date_from).format('DD-MM-YYYY');
  const toFile = dayjs(date_to).format('DD-MM-YYYY');
  const timeStr = dayjs().format('HH:mm');
  const grandTotal = dailySummary.reduce((s, d) => s + d.total_subtotal, 0);

  const lines: string[] = [];

  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  if (groupName) lines.push(centerLine(groupName.toUpperCase()));
  lines.push(centerLine('SUBTOTALES POR FECHA'));
  lines.push(centerLine(`${fromStr} AL ${toStr}`));
  lines.push(centerLine(`HORA: ${timeStr}`));
  lines.push(DIVIDER);
  lines.push(padLine('Fecha'.padEnd(9), 'Subtotal'));
  lines.push(DIVIDER);

  for (const entry of dailySummary) {
    const dateLabel = dayjs(entry.date).format('DD/MM/YY');
    lines.push(padLine(dateLabel, money(entry.total_subtotal)));
  }

  lines.push(DIVIDER);
  lines.push(padLine('TOTAL:', money(grandTotal)));
  if (percentage && percentage > 0) {
    const capitalistaAmount = (grandTotal * percentage) / 100;
    lines.push(DIVIDER);
    lines.push(padLine(`${percentage}% CAPITALISTA:`, money(capitalistaAmount)));
  }
  lines.push(DIVIDER);
  lines.push(DIVIDER);
  lines.push(DIVIDER);

  const docHeight = Math.max(80, lines.length * LINE_H + MARGIN * 2 + 4);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAPER_W, docHeight] });
  doc.setProperties({ title: `Exportar_Subtotales${fileSlug(groupName)}_${fromFile}_${toFile}` });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = MARGIN + 4;
  for (const line of lines) {
    doc.text(line, MARGIN, y);
    y += LINE_H;
  }

  printPdfBlob(doc.output('blob'));
}
