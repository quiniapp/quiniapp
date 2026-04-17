import dayjs from 'dayjs';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { DailyTotalEntry } from '@/hooks/fetchs/current-account/useGetCurrentAccountTotals';

const TICKET_WIDTH = 72; // mm — ancho del ticket (80mm - márgenes)
const MARGIN = { left: 4, right: 4 };
const FONT_SIZE = 8;
const LINE_H = 4.5;

async function getPDFDeps() {
  const { default: jsPDF } = await import('jspdf');
  return { jsPDF };
}

const money = (n: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );

/** Pad string derecha con espacios hasta targetLen, luego agrega valor alineado a la derecha */
function lineWithAmount(doc: any, label: string, amount: string, y: number) {
  doc.text(label, MARGIN.left, y);
  doc.text(amount, TICKET_WIDTH + MARGIN.left - MARGIN.right, y, { align: 'right' });
}

function drawDivider(doc: any, y: number) {
  doc.setLineDashPattern([1, 1], 0);
  doc.line(MARGIN.left, y, TICKET_WIDTH + MARGIN.left - MARGIN.right, y);
  doc.setLineDashPattern([], 0);
}

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

  // Calcular alto del documento dinámicamente
  const headerLines = (orgName ? 1 : 0) + (groupName ? 1 : 0) + 3;
  const mePagoLines = mePago.length + 2; // items + encabezado + subtotal
  const lePagoLines = lePago.length + 2;
  const expenseLines = expenses.length > 0 ? expenses.length + 2 : 2;
  const footerLines = 2;
  const totalLines = headerLines + mePagoLines + lePagoLines + expenseLines + footerLines + 6; // 6 = separadores/espacios
  const docHeight = Math.max(100, totalLines * LINE_H + 20);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, docHeight],
  });

  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = 8;

  // Encabezado
  doc.setFontSize(FONT_SIZE + 1);
  doc.setFont('Courier', 'bold');
  if (orgName) {
    doc.text(orgName.toUpperCase(), 80 / 2, y, { align: 'center' });
    y += LINE_H;
  }
  if (groupName) {
    doc.text(groupName.toUpperCase(), 80 / 2, y, { align: 'center' });
    y += LINE_H;
  }
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);
  doc.text(`FECHA: ${dateStr}`, 80 / 2, y, { align: 'center' });
  y += LINE_H;
  doc.text('ENTRADA Y SALIDA DEL DIA', 80 / 2, y, { align: 'center' });
  y += LINE_H + 2;

  drawDivider(doc, y);
  y += 3;

  // Sección "Me Pagó"
  if (mePago.length > 0) {
    for (const acc of mePago) {
      lineWithAmount(doc, `${acc.user_number} Me Pagó`, money(acc.collections ?? 0), y);
      y += LINE_H;
    }
    y += 1;
    doc.setFont('Courier', 'bold');
    lineWithAmount(doc, 'Sub-I. Entr.:', money(totalCollections), y);
    doc.setFont('Courier', 'normal');
    y += LINE_H + 1;
  }

  drawDivider(doc, y);
  y += 3;

  // Sección "Le Pagó"
  if (lePago.length > 0) {
    for (const acc of lePago) {
      lineWithAmount(doc, `${acc.user_number} Le Pagó`, money(acc.paid ?? 0), y);
      y += LINE_H;
    }
    y += 1;
    doc.setFont('Courier', 'bold');
    lineWithAmount(doc, 'Sub-I. Sal.:', money(totalPaid), y);
    doc.setFont('Courier', 'normal');
    y += LINE_H + 1;
  }

  drawDivider(doc, y);
  y += 3;

  // Gastos
  if (expenses.length > 0) {
    for (const exp of expenses) {
      lineWithAmount(doc, exp.nombre, money(exp.monto), y);
      y += LINE_H;
    }
    y += 1;
  }
  doc.setFont('Courier', 'bold');
  lineWithAmount(doc, 'GASTOS:', money(totalExpenses), y);
  doc.setFont('Courier', 'normal');
  y += LINE_H + 1;

  drawDivider(doc, y);
  y += 3;

  // Saldo del día
  doc.setFontSize(FONT_SIZE + 1);
  doc.setFont('Courier', 'bold');
  lineWithAmount(doc, 'SALDO DEL DIA:', money(saldoDia), y);
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  doc.save(`Totales_${dateStr.replace(/\//g, '-')}.pdf`);
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
  const percentageAmount = (grandTotal * percentage) / 100;

  const fromStr = dayjs(date_from).format('DD/MM/YYYY');
  const toStr = dayjs(date_to).format('DD/MM/YYYY');

  const totalLines =
    (orgName ? 1 : 0) + (groupName ? 1 : 0) + 3 + dailyTotals.length + 5;
  const docHeight = Math.max(100, totalLines * LINE_H + 20);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, docHeight],
  });

  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = 8;

  // Encabezado
  doc.setFontSize(FONT_SIZE + 1);
  doc.setFont('Courier', 'bold');
  if (orgName) {
    doc.text(orgName.toUpperCase(), 80 / 2, y, { align: 'center' });
    y += LINE_H;
  }
  if (groupName) {
    doc.text(groupName.toUpperCase(), 80 / 2, y, { align: 'center' });
    y += LINE_H;
  }
  doc.setFont('Courier', 'normal');
  doc.setFontSize(FONT_SIZE);
  doc.text(`FECHA: ${fromStr} AL ${toStr}`, 80 / 2, y, { align: 'center' });
  y += LINE_H;
  doc.text('BALANCE DE ENTRADA-SALIDA', 80 / 2, y, { align: 'center' });
  y += LINE_H + 2;

  drawDivider(doc, y);
  y += 3;

  // Totales por día (usa net_balance = total_balance - expenses)
  for (const entry of dailyTotals) {
    const dateLabel = dayjs(entry.date).format('DD/MM/YY');
    lineWithAmount(doc, dateLabel, money(entry.net_balance), y);
    y += LINE_H;
  }

  y += 1;
  drawDivider(doc, y);
  y += 3;

  doc.setFont('Courier', 'bold');
  lineWithAmount(doc, 'UN A LA FECHA:', money(grandTotal), y);
  y += LINE_H + 2;

  lineWithAmount(doc, `${percentage}%:`, money(percentageAmount), y);
  doc.setFont('Courier', 'normal');

  doc.save(`Totales_Rango_${fromStr.replace(/\//g, '-')}_${toStr.replace(/\//g, '-')}.pdf`);
}
