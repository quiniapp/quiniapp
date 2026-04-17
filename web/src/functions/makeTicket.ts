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
  [PLACE_TYPE.HEAD]:   '01',
  [PLACE_TYPE.FIVE]:   '05',
  [PLACE_TYPE.TEN]:    '10',
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

// ── grouping (same logic as original) ────────────────────────────────────────
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
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ── PDF builder ───────────────────────────────────────────────────────────────
export async function makeTicketPdf({
  ticket,
  bets,
  cashier_number,
}: {
  ticket: ITicketEntityFront;
  bets: IBetTable[];
  cashier_number?: number;
}) {
  const { jsPDF } = await import('jspdf');

  // Group bets by schedule-lottery combination
  type Group = { header: ILotterySchedule[]; items: IBetTable[] };
  const groupsMap = new Map<string, Group>();
  for (const bet of bets) {
    const key = comboKey(bet.scheduleLottery);
    if (!groupsMap.has(key)) groupsMap.set(key, { header: bet.scheduleLottery, items: [] });
    groupsMap.get(key)!.items.push(bet);
  }
  const groups = Array.from(groupsMap.values());

  // Pre-measure header lines per group using a throwaway doc
  const measureDoc = new jsPDF({ unit: 'mm', format: [PAGE_W, 200] });
  measureDoc.setFont('helvetica', 'bold');
  measureDoc.setFontSize(7);
  const groupHeaderLineCounts = groups.map((g) =>
    (measureDoc.splitTextToSize(compactHeader(g.header), CONTENT_W) as string[]).length
  );

  // Calculate exact page height
  let exactH = MARGIN + 2;
  if (cashier_number !== undefined) exactH += 7;
  exactH += 6 + 3;                                                   // Ticket + divider
  exactH += 5 + 3;                                                   // Fecha+Hora single row + divider
  for (let i = 0; i < groups.length; i++) {
    exactH += groupHeaderLineCounts[i] * 4 + 1;                    // group header
    exactH += groups[i].items.length * 5;                          // bet rows
    exactH += 3;                                                    // dashed divider
  }
  exactH += 9 + 3 + 1;                                             // Total + divider + tiny bottom margin

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
  if (cashier_number !== undefined) {
    doc.text(`Usuario: ${cashier_number}`, cx, y, { align: 'center' });
    y += 7;
  }
  doc.text(`Ticket: ${ticket.ticket_number}`, cx, y, { align: 'center' });
  y += 6;

  divider();

  // Thermal printer renders at fixed 32-char line width — use char-count padding
  const CHARS_PER_LINE = 32;
  const padLine = (left: string, right: string) => {
    const spaces = Math.max(1, CHARS_PER_LINE - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };

  // ── Fecha / Hora ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(padLine(dayjs(ticket.date).format('DD/MM/YYYY'), dayjs().format('HH:mm:ss')), MARGIN, y);
  y += 5;

  divider();

  // ── Groups ────────────────────────────────────────────────────────────────
  // Pre-compute monospace column widths for bet rows (Courier 8pt)
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  const monoSf    = (doc as any).internal.scaleFactor as number;
  const monoCharW = doc.getStringUnitWidth('0') * 8 / monoSf;
  // Column widths in chars (match original mm positions: normal=14mm, borratina=26mm)
  const NUM_COL_NORMAL    = Math.round(14 / monoCharW);
  const NUM_COL_BORRATINA = Math.round(26 / monoCharW);
  const TYPE_COL = 7; // "01/05" max 5 chars + padding

  // Use same numCol for ALL groups so type column aligns across the ticket
  const ticketHasBorratina = bets.some((b) => b.number.length === 10);
  const numCol = ticketHasBorratina ? NUM_COL_BORRATINA : NUM_COL_NORMAL;
  const amtCol = CHARS_PER_LINE - numCol - TYPE_COL;

  for (const g of groups) {

    // Compact schedule-lottery header, auto-wrapped
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const headerText = compactHeader(g.header);
    const headerLines = doc.splitTextToSize(headerText, CONTENT_W) as string[];
    for (const line of headerLines) {
      doc.text(line, MARGIN, y);
      y += 4;
    }
    y += 1;

    // Bets in this group — single string per row to preserve columns on thermal printers
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    for (const bet of g.items) {
      const num    = formatBetNum(bet);
      const type   = bet.number.length === 10 ? 'BORR' : placeLabel(bet.place, bet.position);
      const amount = '$' + fmtAmount(bet.amount);
      const row = num.padEnd(numCol) + type.padEnd(TYPE_COL) + amount.padStart(Math.max(0, amtCol));
      doc.text(row, MARGIN, y);
      y += 5;
    }

    divider(true);
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total: ${fmtAmount(ticket.total)}`, cx, y + 1, { align: 'center' });
  y += 9;

  divider(true);

  const blob     = doc.output('blob');
  const fileName = `ticket-${ticket.ticket_number}.pdf`;
  return { blob, fileName };
}

// ── print / share (unchanged) ─────────────────────────────────────────────────

export function printPdfBlob(blob: Blob) {
  const url    = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
}

export async function sharePdfBlob(
  blob: Blob,
  fileName: string,
  opts?: { text?: string; urlForWa?: string }
) {
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Ticket', text: opts?.text ?? 'Te comparto el ticket', files: [file] });
      return true;
    }
  } catch {
    // fall through
  }
  const message = encodeURIComponent(opts?.text ?? 'Te comparto el ticket');
  const link    = opts?.urlForWa ? `%0A${encodeURIComponent(opts.urlForWa)}` : '';
  window.open(`https://wa.me/?text=${message}${link}`, '_blank', 'noopener,noreferrer');
  return false;
}
