import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import {ITicketEntityFront} from '../../../helper/types/ticket.type'
import { IBetTable } from '@/features/play-details';

export function makeTicketPdf(ticket: ITicketEntityFront, bets:IBetTable[]) {
  const WIDTH_CHARS = 32;
  const LINE = '='.repeat(WIDTH_CHARS);
  const pad = (s: string) =>
    s.length > WIDTH_CHARS ? s.slice(0, WIDTH_CHARS) : s.padEnd(WIDTH_CHARS, ' ');

  bets.map(bet=>{
     const schedLot =  bet.scheduleLottery.map((lotSched) => {
                      return `${lotSched.schedule.name}-${lotSched.lotteries.map((lot) => lot.name).join(', ')}`;
                    })
                    
  })
  // contenido fijo de 32 cols
  const lines = [
    LINE,
    pad(`Ticket: ${ticket.ticket_number}`),
    pad(`Fecha: ${dayjs(ticket.date).format('DD-MM-YYYY')}`),                 // o: dayjs(dateStr).format('DD/MM/YYYY')
    pad(`Hora: ${dayjs().format('HH:mm')}`),
    LINE,
    LINE,
    pad(`Total: $${ticket.total}`),
    LINE,
  ];

  // PDF pequeño (similar a rollo 58mm)
  const pageWidthMm = 58;
  const marginMm = 2;
  const lineHeightMm = 10;
  const pageHeightMm = marginMm * 2 + lines.length * lineHeightMm;

  const doc = new jsPDF({ unit: 'mm', format: [pageWidthMm, pageHeightMm] });
  doc.setFont('courier', 'normal'); // monoespaciada para respetar las 32 cols
  doc.setFontSize(6);

  let y = marginMm;
  lines.forEach((text, i) => doc.text(text, marginMm, y + i * lineHeightMm));

  // descarga el archivo; si prefieres abrir para imprimir: doc.autoPrint(); doc.output('dataurlnewwindow');
  doc.save(`ticket-${ticket.ticket_number}.pdf`);
}
