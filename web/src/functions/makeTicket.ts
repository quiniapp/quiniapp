import dayjs from 'dayjs';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.request';
import { PLACE_TYPE } from '@helper/types/bet.type';

// ── constants ─────────────────────────────────────────────────────────────────
const PAGE_W = 58;
const MARGIN = 3;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── place codes ───────────────────────────────────────────────────────────────
const PLACE_CODE: Record<PLACE_TYPE, string> = {
  [PLACE_TYPE.HEAD]: '01',
  [PLACE_TYPE.FIVE]: '05',
  [PLACE_TYPE.TEN]: '10',
  [PLACE_TYPE.TWENTY]: '20',
};

function placeLabel(place: PLACE_TYPE, position?: PLACE_TYPE | null): string {
  const base = PLACE_CODE[place] ?? place;
  return position ? `${base}/${PLACE_CODE[position] ?? position}` : base;
}

/** Format number column based on inferred bet type:
 *  - 10 digits            → BORRATINA  → show as-is
 *  - bet.with is set      → REDOUBLE   → "12-34"
 *  - otherwise            → ONE/DOUBLE/TERN/QUATERN → pad to 4 with '*'
 */
function formatBetNum(bet: IBetTable): string {
  if (bet.number.length === 10) return bet.number;
  if (bet.with) return `${bet.number}-${bet.with}`;
  return bet.number.padStart(4, '*');
}

// ── grouping ──────────────────────────────────────────────────────────────────
function comboKey(scheduleLottery: ILotterySchedule[]): string {
  return scheduleLottery
    .map((sl) => ({
      sid: String((sl.schedule as any).schedule_id ?? sl.schedule.name),
      lids: sl.lotteries.map((l) => String((l as any).lottery_id ?? l.name)).sort(),
    }))
    .sort((a, b) => a.sid.localeCompare(b.sid))
    .map((p) => `${p.sid}:${p.lids.join(',')}`)
    .join('|');
}

/** "Prev-NPSEC Pri-NPSEC ..." — one token per schedule, lotteries concatenated */
function compactHeader(scheduleLottery: ILotterySchedule[]): string {
  return scheduleLottery
    .map((sl) => {
      const sch = sl.schedule.name.slice(0, 3);
      const lots = sl.lotteries.map((l) => l.name[0]).join('');
      return `${sch}-${lots}`;
    })
    .join(' ');
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── contenido (compartido por el PDF y la imagen) ────────────────────────────
export type PrintableTicket = {
  ticket: ITicketEntityFront;
  bets: IBetTable[];
  cashier_number?: number;
};

export type TicketContent = {
  cashierLine?: string;
  ticketLine: string;
  /** Fecha y hora ya separadas con espacios para ocupar CHARS_PER_LINE */
  dateLine: string;
  groups: { header: string; rows: string[] }[];
  totalLine: string;
};

// Thermal printer renders at fixed 32-char line width — use char-count padding
export const CHARS_PER_LINE = 32;
// Column widths in chars (match original mm positions: borratina=26mm).
// Courier ocupa 0.6em por carácter: a 8pt son ~1.69mm, así que 26mm ≈ 15 caracteres
const NUM_COL = 15;
const TYPE_COL = 7; // "01/05" max 5 chars + padding
const AMT_COL = CHARS_PER_LINE - NUM_COL - TYPE_COL;

const padLine = (left: string, right: string) => {
  const spaces = Math.max(1, CHARS_PER_LINE - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
};

export function buildTicketContent({ ticket, bets, cashier_number }: PrintableTicket): TicketContent {
  // Group bets by schedule-lottery combination
  type Group = { header: ILotterySchedule[]; items: IBetTable[] };
  const groupsMap = new Map<string, Group>();
  for (const bet of bets) {
    const key = comboKey(bet.scheduleLottery);
    if (!groupsMap.has(key)) groupsMap.set(key, { header: bet.scheduleLottery, items: [] });
    groupsMap.get(key)!.items.push(bet);
  }

  // Bets — single string per row to preserve columns on thermal printers
  const groups = Array.from(groupsMap.values()).map((g) => ({
    header: compactHeader(g.header),
    rows: g.items.map((bet) => {
      const num = formatBetNum(bet);
      const type = bet.number.length === 10 ? 'BORR' : placeLabel(bet.place, bet.position);
      const amount = '$' + fmtAmount(bet.amount);
      return num.padEnd(NUM_COL) + type.padEnd(TYPE_COL) + amount.padStart(Math.max(0, AMT_COL));
    }),
  }));

  return {
    cashierLine: cashier_number !== undefined ? `Usuario: ${cashier_number}` : undefined,
    ticketLine: `Ticket: ${ticket.ticket_number}`,
    dateLine: padLine(dayjs(ticket.date).format('DD/MM/YYYY'), dayjs().format('HH:mm:ss')),
    groups,
    totalLine: `Total: $${fmtAmount(ticket.total)}`,
  };
}

// ── PDF builder ───────────────────────────────────────────────────────────────
export async function makeTicketPdf(data: PrintableTicket) {
  const { jsPDF } = await import('jspdf');
  const content = buildTicketContent(data);
  const { groups } = content;

  // Pre-measure header lines per group using a throwaway doc
  const measureDoc = new jsPDF({ unit: 'mm', format: [PAGE_W, 200] });
  measureDoc.setFont('helvetica', 'bold');
  measureDoc.setFontSize(7);
  const groupHeaderLineCounts = groups.map(
    (g) => (measureDoc.splitTextToSize(g.header, CONTENT_W) as string[]).length
  );

  // Calculate exact page height
  let exactH = MARGIN + 2;
  if (content.cashierLine) exactH += 7;
  exactH += 6 + 3; // Ticket + divider
  exactH += 5 + 3; // Fecha+Hora single row + divider
  for (let i = 0; i < groups.length; i++) {
    exactH += groupHeaderLineCounts[i] * 4 + 1; // group header
    exactH += groups[i].rows.length * 5; // bet rows
    exactH += 3; // dashed divider
  }
  exactH += 9 + 3 + 1; // Total + divider + tiny bottom margin

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, exactH] });
  let y = MARGIN + 2;

  // Thermal printers often ignore doc.line() — use text chars for reliable rendering
  const divider = (dashed = false) => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(dashed ? '- '.repeat(16) : '-'.repeat(32), MARGIN, y);
    y += 3;
  };

  const cx = PAGE_W / 2;

  // ── Usuario / Ticket ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (content.cashierLine) {
    doc.text(content.cashierLine, cx, y, { align: 'center' });
    y += 7;
  }
  doc.text(content.ticketLine, cx, y, { align: 'center' });
  y += 6;

  // ── Fecha / Hora ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(content.dateLine, MARGIN, y);
  y += 5;

  divider(true);
  // ── Groups ────────────────────────────────────────────────────────────────
  for (const g of groups) {
    // Compact schedule-lottery header, auto-wrapped
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const headerLines = doc.splitTextToSize(g.header, CONTENT_W) as string[];
    for (const line of headerLines) {
      doc.text(line, MARGIN, y);
      y += 4;
    }
    y += 1;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    for (const row of g.rows) {
      doc.text(row, MARGIN, y);
      y += 5;
    }

    divider(true);
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(content.totalLine, cx, y + 1, { align: 'center' });
  y += 9;

  divider(true);

  divider();
  divider();
  const blob = doc.output('blob');
  const fileName = `ticket-${data.ticket.ticket_number}.pdf`;
  return { blob, fileName };
}

// ── print ─────────────────────────────────────────────────────────────────────

export function printPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    const cleanup = () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
      iframe.contentWindow?.removeEventListener('afterprint', cleanup);
    };
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    iframe.contentWindow?.print();
  };
}
