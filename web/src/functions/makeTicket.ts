import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.request';

// ======= width y utilidades base =======
const WIDTH = 32;
const LINE = '='.repeat(WIDTH);

const pad = (s: string) => (s.length > WIDTH ? s.slice(0, WIDTH) : s.padEnd(WIDTH, ' '));
function comboKey(scheduleLottery: ILotterySchedule[]): string {
  const parts = scheduleLottery
    .map(sl => ({
      sid: String((sl.schedule as any).schedule_id ?? sl.schedule.name),
      lids: sl.lotteries.map(l => String((l as any).lottery_id ?? l.name)).sort(), // ordena sólo para la key
    }))
    .sort((a, b) => a.sid.localeCompare(b.sid)) // ordena sólo para la key
    .map(p => `${p.sid}:${p.lids.join(',')}`);
  return parts.join('|');
}

// ✅ Header EXACTAMENTE en el orden provisto en cada bet
type ComboHeader = Array<{ scheduleName: string; lotteryName: string }>;

function comboHeader(scheduleLottery: ILotterySchedule[]): ComboHeader {
  const rows: ComboHeader = [];
  for (const sl of scheduleLottery) {
    for (const lot of sl.lotteries) {
      rows.push({ scheduleName: sl.schedule.name, lotteryName: lot.name });
    }
  }
  return rows; // sin sort
}

function formatNumberLine(
  num: string,
  amount: number,
  bet_type: string,
  opts?: { numWidth?: number; currency?: boolean }
) {
  const numWidth = opts?.numWidth ?? 10; // soporta hasta 10 cifras; ajusta si querés

  const digits = num.length <= numWidth ? num : num.slice(num.length - numWidth); // conserva las 'numWidth' de la derecha
  const numField = digits.padStart(numWidth, ' ');

  // monto a la derecha de la línea
  const amtStr =`$${amount}`

  const left = `${numField} ${bet_type}`;
  const spaces = Math.max(0, WIDTH - left.length - amtStr.length);
  return left + ' '.repeat(spaces - 2) + 'X ' + amtStr;
}



type Ticket = {
  user_name?: number;
  ticket_number: string;
  date: string; // ISO o 'YYYY-MM-DD'
  total: number;
};

function formatEnBlock(rows: ComboHeader): string[] {
  // Primera línea: "En:"
  const out: string[] = [pad('En:')];
  for (const r of rows) {
    // Ej: "Nacional - noche"
    const line = `${r.lotteryName} - ${r.scheduleName}`;
    out.push(pad(line));
  }
  return out;
}
// ======= NUEVA buildTicketLines agrupada =======
function buildTicketLines(ticket: Ticket, bets: IBetTable[]): string[] {
  const lines: string[] = [];
  lines.push(LINE);
  lines.push(pad(`Usuario: ${ticket.user_name}`));
  lines.push(pad(`Ticket: ${ticket.ticket_number}`));
  lines.push(pad(`Fecha: ${ticket.date}`));
  lines.push(pad(`Hora: ${dayjs().format('HH:mm')}`));
  lines.push(LINE);

  // 1) Agrupar ignorando el orden (comboKey), pero RECORDAR el orden del primer bet del grupo
  type Group = {
    key: string;
    header: ComboHeader;   // viene en el orden del primer bet que vimos
    items: IBetTable[];    // números en el orden en que llegaron
  };
  const groupsMap = new Map<string, Group>();

  for (const bet of bets) {
    const key = comboKey(bet.scheduleLottery);
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        header: comboHeader(bet.scheduleLottery), // orden directo, sin sort
        items: [],
      });
    }
    groupsMap.get(key)!.items.push(bet);
  }

  // 2) Orden de grupos = orden de primera aparición
  const groups = Array.from(groupsMap.values());

  // 3) Render
  for (const g of groups) {
    // "En:" respetando el orden provisto en el bet
    lines.push(...formatEnBlock(g.header));
    lines.push('');

    for (const bet of g.items) {
      lines.push(
        formatNumberLine(
          `${bet.number}${bet.with ? `-${bet.with}` : ''}`,
          bet.amount,
          `${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`.trim(),
          { numWidth: 10 }
        )
      );
      lines.push('');
    }

    lines.push('-'.repeat(WIDTH));
  }

  lines.push(LINE);
  lines.push(pad(`Total: $${ticket.total}`));
  lines.push(LINE);

  return lines;
}



interface MakeTicketPdfProps{
  ticket: ITicketEntityFront, bets: IBetTable[], cashier_number?:number
}

function addFeedLines(lines: string[], extraMm: number, lineHeightMm: number) {
  // cuántas líneas agregar para alcanzar ~extraMm
  const extraLines = Math.ceil(extraMm / lineHeightMm);
  for (let i = 0; i < extraLines; i++) {
    // guiones o vacío: elegí lo que prefieras
    lines.push('-'.repeat(WIDTH));
  }
  return lines;
}


//blob 
export function makeTicketPdf({ ticket, bets, cashier_number }: MakeTicketPdfProps) {
  let lines = buildTicketLines(
    {
      user_name: cashier_number,
      ticket_number: ticket.ticket_number,
      date: dayjs(ticket.date).format('DD-MM-YYYY'),
      total: ticket.total,
    },
    bets
  );

  const pageWidthMm = 58;
  const marginMm = 2;
  const topOffsetMm = marginMm + 3;
  const lineHeightMm = 4.5;

  lines = addFeedLines(lines, 15, lineHeightMm);

  const contentHeightMm = lines.length ? (lines.length - 1) * lineHeightMm : 0;
  const pageHeightMm = topOffsetMm + contentHeightMm + marginMm;

  const doc = new jsPDF({
    unit: 'mm',
    format: [pageWidthMm, Math.max(pageHeightMm, 40)],
  });

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  lines.forEach((text, i) => {
    const y = topOffsetMm + i * lineHeightMm;
    doc.text(text, marginMm, y);
  });

  // 👇 en vez de doc.save(...) devolvemos el Blob
  const blob = doc.output('blob'); // application/pdf
  const fileName = `ticket-${ticket.ticket_number}.pdf`;
  return { blob, fileName };
}


// pdfActions.ts
export function printPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);



  iframe.onload = () => {
    // algunos navegadores requieren focus
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

  };
}

/** Web Share API (Chrome Android) → comparte archivo directamente
 * Fallback: abre wa.me con texto y (opcional) un URL público si lo tenés
 */
export async function sharePdfBlob(blob: Blob, fileName: string, opts?: { text?: string; urlForWa?: string }) {
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Ticket',
        text: opts?.text ?? 'Te comparto el ticket',
        files: [file],
      });
      return true;
    }
  } catch (e) {
    // continua al fallback
  }

  // Fallback: WhatsApp con texto + URL si lo tenés (wa.me no acepta adjuntar archivos)
  const message = encodeURIComponent(opts?.text ?? 'Te comparto el ticket');
  const link = opts?.urlForWa ? `%0A${encodeURIComponent(opts.urlForWa)}` : '';
  const waUrl = `https://wa.me/?text=${message}${link}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  return false;
}
