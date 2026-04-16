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
      const sch = sl.schedule.name.slice(0, 4);
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

  // Estimate page height
  const betCount = bets.length;
  const headerLinesPerGroup = groups.length * 2; // compact header + spacer
  const pageH = 50 + headerLinesPerGroup * 5 + betCount * 5 + 20;

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, Math.max(pageH, 60)] });
  let y = MARGIN + 2;

  const divider = (dashed = false) => {
    doc.setLineDashPattern(dashed ? [1, 1] : [], 0);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setLineDashPattern([], 0);
    y += 3;
  };

  const cx = PAGE_W / 2;

  // ── Vendedor / Ticket ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (cashier_number !== undefined) {
    doc.text(`Vendedor: ${cashier_number}`, cx, y, { align: 'center' });
    y += 7;
  }
  doc.text(`Ticket: ${ticket.ticket_number}`, cx, y, { align: 'center' });
  y += 6;

  divider();

  // ── Fecha / Hora ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Fecha', MARGIN, y);
  doc.text('Hora', PAGE_W - MARGIN, y, { align: 'right' });
  y += 4;
  doc.setFontSize(8);
  doc.text(dayjs(ticket.date).format('DD/MM/YYYY'), MARGIN, y);
  doc.text(dayjs().format('HH:mm:ss'), PAGE_W - MARGIN, y, { align: 'right' });
  y += 5;

  divider();

  // ── Groups ────────────────────────────────────────────────────────────────
  const numX    = MARGIN;
  const typeX   = MARGIN + 20;
  const amountX = PAGE_W - MARGIN;

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

    // Bets in this group
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    for (const bet of g.items) {
      const num    = `${bet.number}${bet.with ? `-${bet.with}` : ''}`;
      const type   = placeLabel(bet.place, bet.position);
      const amount = fmtAmount(bet.amount);
      doc.text(num,    numX,    y);
      doc.text(type,   typeX,   y);
      doc.text(amount, amountX, y, { align: 'right' });
      y += 5;
    }

    divider(true);
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total: ${fmtAmount(ticket.total)}`, cx, y + 1, { align: 'center' });
  y += 9;

  divider();

  // ── Ticket ID ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(ticket.ticket_id ?? '', cx, y, { align: 'center' });

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
