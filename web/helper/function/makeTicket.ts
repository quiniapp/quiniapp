import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '../../../helper/types/ticket.type';
import { IBetTable } from '@/features/play-details';
import { betPlaceDictionary } from '../../../helper/functions/betPlaceDictionary';

// ======= width y utilidades base =======
const WIDTH = 32;
const LINE = '='.repeat(WIDTH);

const pad = (s: string) => (s.length > WIDTH ? s.slice(0, WIDTH) : s.padEnd(WIDTH, ' '));

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

function buildTicketLines(ticket: Ticket, bets: IBetTable[]): string[] {
  const lines: string[] = [];
  lines.push(LINE);
  lines.push(pad(`Usuario: ${ticket.user_name}`));
  lines.push(pad(`Ticket: ${ticket.ticket_number}`));
  // formateá la fecha antes si usás dayjs, acá va crudo:
  lines.push(pad(`Fecha: ${ticket.date}`));
  lines.push(pad(`Hora: ${dayjs().format('HH:mm')}`));
  lines.push(LINE);

  for (const bet of bets) {
    // 1) una o varias líneas "En: schedule - lot1, lot2"
    for (const sl of bet.scheduleLottery) {
      const lotNames = sl.lotteries.map((l) => l.name);
      lines.push(formatEnLine(sl.schedule.name, lotNames));
    }
    // 2) línea del número principal alineada por unidades
    lines.push(
      formatNumberLine(
        `${bet.number}${bet.with?`-${bet.with}`:''}`,
        bet.amount,
        `${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`,
        { numWidth: 10 }
      )
    );

    // separador fino entre apuestas
    lines.push('-'.repeat(WIDTH));
  }

  // pie de ticket
  lines.push(LINE);
  lines.push(pad(`Total: $${ticket.total}`));
  lines.push(LINE);

  return lines;
}


interface MakeTicketPdfProps{
  ticket: ITicketEntityFront, bets: IBetTable[], cashier_number?:number
}

export function makeTicketPdf({ticket, bets, cashier_number}:MakeTicketPdfProps) {
  const lines = buildTicketLines(
    {
      user_name: cashier_number,
      ticket_number: ticket.ticket_number,
      date: dayjs(ticket.date).format('DD-MM-YYYY'),
      total: ticket.total,
    },
    bets
  );

  // Tamaño exacto según contenido
  const marginMm = 2;
  const lineHeightMm = 4.5;                    // un poco más compacto

  // 👉 usar el alto dinámico acá
  const doc = new jsPDF();

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  let y = marginMm + 3;                        // leve offset visual
  lines.forEach((text, i) => doc.text(text, marginMm, y + i * lineHeightMm));

  // Si querés lanzar diálogo directo:
  // doc.autoPrint(); doc.output('dataurlnewwindow');

  doc.save(`ticket-${ticket.ticket_number}.pdf`);
}
