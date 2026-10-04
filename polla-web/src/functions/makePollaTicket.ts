import dayjs from 'dayjs';

// Mismas convenciones que makeTicket.ts: impresora térmica de 58mm, texto
// monoespaciado (Courier) para que las columnas no se desalineen en el
// hardware térmico, 32 caracteres por línea.
const PAGE_W = 58;
const MARGIN = 3;
const CHARS_PER_LINE = 32;

function fmtAmount(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export interface PollaTicketData {
  ticket_number: string;
  user_name: string;
  cashier_number?: number;
  numbers: string[]; // 10 números de 2 cifras
  lotteryName: string;
  scheduleName: string;
  startDate: string;
  endDate: string;
  loadDate: string;
  ticketPrice: number;
  poolAmount: number;
}

export async function makePollaTicketPdf(data: PollaTicketData) {
  const { jsPDF } = await import('jspdf');

  // 1 línea de header (usuario) + 1 (ticket) + 2 (edición, puede wrapear) +
  // 1 (fecha/hora) + 5 filas de números + total + pozo + márgenes/divisores.
  const exactH =
    MARGIN +
    2 +
    (data.cashier_number !== undefined ? 7 : 0) +
    6 + // Ticket
    3 + // divider
    8 + // edición (2 líneas)
    5 + // fecha/hora
    3 + // divider
    5 * 5 + // 5 filas de números
    3 + // divider
    9 + // precio ticket
    9 + // pozo
    3 + // divider
    3 +
    3 +
    2; // margen final

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, exactH] });
  let y = MARGIN + 2;
  const cx = PAGE_W / 2;

  const divider = (dashed = false) => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(dashed ? '- '.repeat(16) : '-'.repeat(32), MARGIN, y);
    y += 3;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (data.cashier_number !== undefined) {
    doc.text(`Usuario: ${data.cashier_number}`, cx, y, { align: 'center' });
    y += 7;
  }
  doc.text(`Ticket: ${data.ticket_number}`, cx, y, { align: 'center' });
  y += 6;

  divider(true);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('POLLA', cx, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`${data.lotteryName} - ${data.scheduleName}`, cx, y, { align: 'center' });
  y += 4;
  doc.text(
    `Semana: ${dayjs(data.startDate).format('DD/MM')} al ${dayjs(data.endDate).format('DD/MM')}`,
    cx,
    y,
    { align: 'center' }
  );
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const padLine = (left: string, right: string) => {
    const spaces = Math.max(1, CHARS_PER_LINE - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };
  doc.text(
    padLine(dayjs(data.loadDate).format('DD/MM/YYYY'), dayjs().format('HH:mm:ss')),
    MARGIN,
    y
  );
  y += 5;

  divider(true);

  // Grilla de 10 números: 2 columnas x 5 filas, numeradas 1..10 en orden de
  // lectura (fila por fila), ej: "1. 07    2. 45".
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  const colWidth = CHARS_PER_LINE / 2;
  for (let row = 0; row < 5; row++) {
    const leftIdx = row * 2;
    const rightIdx = row * 2 + 1;
    const leftCell = `${leftIdx + 1}.`.padEnd(4) + (data.numbers[leftIdx] ?? '--');
    const rightCell = `${rightIdx + 1}.`.padEnd(4) + (data.numbers[rightIdx] ?? '--');
    doc.text(leftCell.padEnd(colWidth) + rightCell, MARGIN, y);
    y += 5;
  }

  divider(true);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Valor ticket: $${fmtAmount(data.ticketPrice)}`, MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Pozo: $${fmtAmount(data.poolAmount)}`, MARGIN, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(data.user_name, MARGIN, y);
  y += 5;

  divider(true);
  divider();
  divider();

  const blob = doc.output('blob');
  const fileName = `polla-${data.ticket_number}.pdf`;
  return { blob, fileName };
}
