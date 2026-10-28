import dayjs from 'dayjs';
import type { jsPDF } from 'jspdf';

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
  /** Identificador del ticket ("chicho"), si tiene. */
  identifier?: string | null;
  /** Pasador como `{grupo}-{número}` (ver `pollaTicketCashierCode`). */
  cashier_code?: string;
  numbers: string[]; // 10 números de 2 cifras
  lotteryName: string;
  scheduleName: string;
  startDate: string;
  endDate: string;
  loadDate: string;
  ticketPrice: number;
  poolAmount: number;
  /** Pozo sorpresa: se imprime aparte si hay. */
  surprisePoolAmount?: number;
  /** Repetido sin cargo: en lugar del precio dice SIN CARGO. */
  isFree?: boolean;
}

/** Alto exacto del ticket (mm): cada página del PDF mide lo que su ticket. */
const ticketHeight = (data: PollaTicketData) =>
  MARGIN +
  2 +
  (data.cashier_code ? 7 : 0) +
  6 + // Ticket
  3 + // divider
  8 + // edición (2 líneas)
  5 + // fecha/hora
  3 + // divider
  5 * 5 + // 5 filas de números
  3 + // divider
  9 + // precio ticket
  9 + // pozo
  (data.surprisePoolAmount ? 4 : 0) + // sorpresa
  (data.identifier ? 4 : 0) + // identificador
  3 + // divider
  3 +
  3 +
  2; // margen final

/** Tamaño de letra (hasta `max`) con que `text` entra en el ancho imprimible. */
const fitFontSize = (doc: jsPDF, text: string, max: number) => {
  const width = PAGE_W - 2 * MARGIN;
  let size = max;
  doc.setFontSize(size);
  while (size > 7 && doc.getTextWidth(text) > width) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
};

/** Dibuja un ticket en la página actual del documento. */
const drawTicket = (doc: jsPDF, data: PollaTicketData) => {
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
  if (data.cashier_code) {
    doc.text(`Usuario: ${data.cashier_code}`, cx, y, { align: 'center' });
    y += 7;
  }
  // El número nuevo ({grupo}-{hora}-{pasador}-{jugador}) no entra en 12 pt.
  const ticketLine = `Ticket: ${data.ticket_number}`;
  doc.setFontSize(fitFontSize(doc, ticketLine, 12));
  doc.text(ticketLine, cx, y, { align: 'center' });
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
  doc.text(
    data.isFree ? 'Valor ticket: SIN CARGO' : `Valor ticket: $${fmtAmount(data.ticketPrice)}`,
    MARGIN,
    y
  );
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Pozo: $${fmtAmount(data.poolAmount)}`, MARGIN, y);
  y += 4;
  if (data.surprisePoolAmount) {
    doc.text(`+ Pozo sorpresa: $${fmtAmount(data.surprisePoolAmount)}`, MARGIN, y);
    y += 4;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(data.user_name, MARGIN, y);
  y += 4;
  if (data.identifier) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Id: ${data.identifier}`, MARGIN, y);
    y += 4;
  }
  y += 1;

  divider(true);
  divider();
  divider();
};

/** Varios tickets en un solo PDF, uno por página (repetir varios a la vez). */
export async function makePollaTicketsPdf(list: PollaTicketData[]) {
  const { jsPDF: JsPDF } = await import('jspdf');

  const [first, ...rest] = list;
  const doc = new JsPDF({ unit: 'mm', format: [PAGE_W, ticketHeight(first)] });
  drawTicket(doc, first);

  for (const data of rest) {
    doc.addPage([PAGE_W, ticketHeight(data)]);
    drawTicket(doc, data);
  }

  const blob = doc.output('blob');
  const fileName =
    list.length === 1 ? `polla-${first.ticket_number}.pdf` : `polla-${list.length}-tickets.pdf`;
  return { blob, fileName };
}

export const makePollaTicketPdf = (data: PollaTicketData) => makePollaTicketsPdf([data]);
