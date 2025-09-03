import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '../../../helper/types/ticket.type';
import { IBetTable, ILotterySchedule } from '@/features/play-details';
import { betPlaceDictionary } from '../../../helper/functions/betPlaceDictionary';

// ======= width y utilidades base =======
const WIDTH = 32;
const LINE = '='.repeat(WIDTH);

const pad = (s: string) => (s.length > WIDTH ? s.slice(0, WIDTH) : s.padEnd(WIDTH, ' '));
function comboKey(scheduleLottery: ILotterySchedule[]): string {
  // Normaliza: ordena por schedule.id y por lottery.id para que combos iguales den la misma key
  const parts = scheduleLottery
    .map(sl => ({
      sid: String((sl.schedule as any).id ?? sl.schedule.name),
      sname: sl.schedule.name,
      lids: sl.lotteries.map(l => String((l as any).id ?? l.name)).sort(),
      lnames: sl.lotteries.map(l => l.name).sort(),
    }))
    .sort((a, b) => a.sid.localeCompare(b.sid))
    .map(p => `${p.sid}:${p.lids.join(',')}`);
  return parts.join('|');
}

type ComboHeader = Array<{ scheduleName: string; lotteryName: string }>;

function comboHeader(scheduleLottery: ILotterySchedule[]): ComboHeader {
  // “En:” + una línea por cada (Lottery - Schedule), como en la imagen
  const rows: ComboHeader = [];
  for (const sl of scheduleLottery) {
    for (const lot of sl.lotteries) {
      rows.push({ scheduleName: sl.schedule.name, lotteryName: lot.name });
    }
  }
  // orden estable por lottery y luego schedule (para que no “salte” el orden)
  rows.sort((a, b) =>
    a.lotteryName === b.lotteryName
      ? a.scheduleName.localeCompare(b.scheduleName)
      : a.lotteryName.localeCompare(b.lotteryName)
  );
  return rows;
}
// word-wrap simple que mantiene palabras enteras
function wrapWords(text: string, width = WIDTH): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    if ((line ? line.length + 1 : 0) + word.length <= width) {
      line = line ? line + ' ' + word : word;
    } else {
      out.push(line.padEnd(width, ' '));
      line = word;
    }
  }
  if (line) out.push(line.padEnd(width, ' '));
  return out.length ? out : [''.padEnd(width, ' ')];
}

// envuelve un “head” fijo + “tail” largo, indentando las siguientes líneas
function wrapHeadTail(head: string, tail: string, width = WIDTH): string[] {
  const headLen = Math.min(head.length, width);
  const firstRoom = width - headLen;
  const words = tail.split(/\s+/);
  let cur = '';
  const lines: string[] = [];

  // primera línea con el head
  while (words.length && (cur ? cur.length + 1 : 0) + words[0].length <= firstRoom) {
    cur = cur ? cur + ' ' + words.shift() : words.shift()!;
  }
  lines.push((head.slice(0, headLen) + (cur || '')).padEnd(width, ' '));

  // resto con indent = headLen espacios
  const indent = ' '.repeat(headLen);
  cur = '';
  while (words.length) {
    if ((cur ? cur.length + 1 : 0) + words[0].length <= width - headLen) {
      cur = cur ? cur + ' ' + words.shift() : words.shift()!;
    } else {
      lines.push((indent + cur).padEnd(width, ' '));
      cur = '';
    }
  }
  if (cur) lines.push((indent + cur).padEnd(width, ' '));
  return lines;
}

// ======= alineación por unidades para el número =======
// numWidth: ancho reservado para el número (p.ej. 10 dígitos). Unidades = última columna del bloque.
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

// ======= "En: schedule - lot1, lot2" =======
function formatEnLine(scheduleName: string, lotteryNames: string[]): string {
  const head = `En: ${scheduleName} - `;
  const tail = lotteryNames.join(', ');
  return head + ' ' + tail;
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

  // 1) Agrupar por combinación completa de scheduleLottery
  type Group = {
    key: string;
    header: ComboHeader;
    items: IBetTable[];
  };
  const groupsMap = new Map<string, Group>();

  for (const bet of bets) {
    const key = comboKey(bet.scheduleLottery);
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        header: comboHeader(bet.scheduleLottery),
        items: [],
      });
    }
    groupsMap.get(key)!.items.push(bet);
  }

  // 2) Orden sugerido de grupos: por primer “Lottery - Schedule” del header
  const groups = Array.from(groupsMap.values()).sort((g1, g2) => {
    const a = g1.header[0] ?? { lotteryName: '', scheduleName: '' };
    const b = g2.header[0] ?? { lotteryName: '', scheduleName: '' };
    return a.lotteryName === b.lotteryName
      ? a.scheduleName.localeCompare(b.scheduleName)
      : a.lotteryName.localeCompare(b.lotteryName);
  });

  // 3) Render de cada grupo
  for (const g of groups) {
    // Bloque “En: …”
    lines.push(...formatEnBlock(g.header));
    lines.push(''); // línea en blanco fina como separador visual

    // Números (uno por línea). Si quisieras compactar “10-20-30…” en una sola,
    // podemos hacerlo luego; por ahora, uno por línea como en tu foto de abajo.
    for (const bet of g.items) {
      lines.push(
        formatNumberLine(
          `${bet.number}${bet.with ? `-${bet.with}` : ''}`,
          bet.amount,
          `${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`.trim(),
          { numWidth: 10 }
        )
      );
      lines.push(''); // pequeño espaciado entre números del mismo grupo
    }

    // separador entre grupos
    lines.push('-'.repeat(WIDTH));
  }

  // 4) Pie
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

  // 👇 Agregamos 1.5 cm en “líneas reales” para forzar feed
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

  doc.save(`ticket-${ticket.ticket_number}.pdf`);
}


