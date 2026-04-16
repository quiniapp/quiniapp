import dayjs from 'dayjs';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.request';
import { PLACE_TYPE } from '@helper/types/bet.type';

// ── constants ─────────────────────────────────────────────────────────────────
const PAGE_W = 58;         // mm
const MARGIN = 3;          // mm each side
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── helpers ───────────────────────────────────────────────────────────────────

/** 3 primeras letras del schedule + guión + 1ª letra de la lottery */
function abbrev(sl: ILotterySchedule): string[] {
  const sch = sl.schedule.name.slice(0, 3);
  return sl.lotteries.map((l) => `${sch}-${l.name[0]}`);
}

/** Collect unique combo abbreviations preserving insertion order */
function uniqueAbbrevs(bets: IBetTable[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const bet of bets) {
    for (const sl of bet.scheduleLottery) {
      for (const a of abbrev(sl)) {
        if (!seen.has(a)) { seen.add(a); out.push(a); }
      }
    }
  }
  return out;
}

/** Place code — matches image "01" style */
const PLACE_CODE: Record<PLACE_TYPE, string> = {
  [PLACE_TYPE.HEAD]:    'C1',
  [PLACE_TYPE.FIVE]:    '05',
  [PLACE_TYPE.TEN]:     '10',
  [PLACE_TYPE.TWENTY]:  '20',
};

function placeLabel(place: PLACE_TYPE, position: PLACE_TYPE | null): string {
  const base = PLACE_CODE[place] ?? place;
  return position ? `${base}/${PLACE_CODE[position] ?? position}` : base;
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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

  // ── measure pass: calculate page height ──────────────────────────────────
  const abbrevs = uniqueAbbrevs(bets);
  const ABBREV_COL_W = 10;                        // mm per abbrev cell (5 chars + space)
  const ABBREVS_PER_ROW = Math.floor(CONTENT_W / ABBREV_COL_W) || 1;
  const abbrevRows = Math.ceil(abbrevs.length / ABBREVS_PER_ROW);

  // Rough height estimate (mm):
  const headerH = 18;          // vendor + ticket (2 lines × 9)
  const dateH   = 14;          // fecha/hora block
  const abbrevH = abbrevRows * 5 + 6;
  const betH    = bets.length * 5 + 6;
  const totalH  = 14;
  const idH     = 8;
  const pageH   = headerH + dateH + abbrevH + betH + totalH + idH + 10;

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, Math.max(pageH, 60)] });

  let y = MARGIN + 2;

  // ── header (Vendedor / Ticket) ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const cx = PAGE_W / 2;

  if (cashier_number !== undefined) {
    doc.text(`Vendedor: ${cashier_number}`, cx, y, { align: 'center' });
    y += 7;
  }
  doc.text(`Ticket: ${ticket.ticket_number}`, cx, y, { align: 'center' });
  y += 6;

  // ── divider ───────────────────────────────────────────────────────────────
  const divider = (dashed = false) => {
    doc.setLineDashPattern(dashed ? [1, 1] : [], 0);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setLineDashPattern([], 0);
    y += 3;
  };

  divider();

  // ── Fecha / Hora ─────────────────────────────────────────────────────────
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

  // ── Lottery/schedule abbreviations ────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (let i = 0; i < abbrevs.length; i += ABBREVS_PER_ROW) {
    const row = abbrevs.slice(i, i + ABBREVS_PER_ROW);
    const line = row.join('  ');
    doc.text(line, MARGIN, y);
    y += 4.5;
  }
  y += 1;

  divider();

  // ── Bets ──────────────────────────────────────────────────────────────────
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  // Column x positions
  const numX    = MARGIN;
  const typeX   = MARGIN + 22;
  const amountX = PAGE_W - MARGIN;

  for (const bet of bets) {
    const num    = `${bet.number}${bet.with ? `-${bet.with}` : ''}`;
    const type   = placeLabel(bet.place, bet.position ?? null);
    const amount = fmtAmount(bet.amount);

    doc.text(num,    numX,    y);
    doc.text(type,   typeX,   y);
    doc.text(amount, amountX, y, { align: 'right' });
    y += 4.5;
  }
  y += 1;

  divider();

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

  // ── output ────────────────────────────────────────────────────────────────
  const blob     = doc.output('blob');
  const fileName = `ticket-${ticket.ticket_number}.pdf`;
  return { blob, fileName };
}

// ── print / share helpers (unchanged) ────────────────────────────────────────

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
    // fall through to WhatsApp fallback
  }
  const message = encodeURIComponent(opts?.text ?? 'Te comparto el ticket');
  const link    = opts?.urlForWa ? `%0A${encodeURIComponent(opts.urlForWa)}` : '';
  window.open(`https://wa.me/?text=${message}${link}`, '_blank', 'noopener,noreferrer');
  return false;
}
