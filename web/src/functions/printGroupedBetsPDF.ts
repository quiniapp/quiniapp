import dayjs from 'dayjs';
import type { IBetEntityFront } from '@helper/types/bet.type';
import { betTypeAndPlaceLabel } from '@helper/functions/betTypeDictionary';
import { formatBetNumber } from '@helper/functions/formatBetNumber';

const money = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

async function getPDFDeps() {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default as any;
  return { jsPDF, autoTable };
}

export async function printGroupedBetsPDF(opts: {
  bets: IBetEntityFront[];
  date?: string | null;
  scheduleName?: string | null;
  lotteryName?: string | null;
  cashierName?: string | null;
  groupName?: string | null;
  grouped?: boolean;
}) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const { bets, date, grouped = true } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const ML = 8;
  const MR = 8;
  const MB = 10;
  const usableW = pageW - ML - MR; // 194mm
  const colGap = 4;
  const halfW = (usableW - colGap) / 2; // 95mm cada columna

  // Anchos por columna (suma = 95mm)
  // Jugada(22) | Monto(14) | Tipo(16) | Turno(15) | Quiniela(15) | Aciertos(13)
  const COLS = [22, 14, 16, 15, 15, 13];

  const FS = 7;           // font size pt
  const CP = 1.5;         // cell padding mm
  const ROW_H = 7;        // altura conservadora por fila (mm)
  const HEAD_H = 8;       // altura del header de tabla

  const HEADER_H = 40;    // área de encabezado fija por página
  const SUMMARY_H = 22;   // resumen de totales, solo en la primera página
  const rowsPerCol = (top: number) => Math.floor((pageH - top - MB - HEAD_H) / ROW_H) - 1;
  const ROWS_PER_COL = rowsPerCol(HEADER_H);
  const FIRST_ROWS_PER_COL = rowsPerCol(HEADER_H + SUMMARY_H);

  const dateStr = date ? dayjs(date).format('D/M/YYYY') : dayjs().format('D/M/YYYY');
  const printedAt = dayjs().format('D/M/YYYY HH:mm');

  const pasador = opts.cashierName || 'Todos';
  const grupo = opts.groupName || 'Todos';
  const turno = opts.scheduleName || 'Todos';
  const loteria = opts.lotteryName || 'Todos';

  const head = [['Jugada', 'Monto', 'Tipo', 'Turno', 'Quiniela', 'Aciert.']];

  const betToRow = (b: IBetEntityFront): string[] => [
    formatBetNumber(b.number, b.bet_type) + (b.with ? ` - ${b.with}` : ''),
    money(b.amount),
    betTypeAndPlaceLabel(b.bet_type, b.place, b.position),
    b.schedule?.name ?? '',
    b.lottery?.name ?? '',
    String(b.hits ?? 0),
  ];

  const totalAmount = bets.reduce((acc, b) => acc + (b.amount ?? 0), 0);
  const totalHits = bets.reduce((acc, b) => acc + (b.hits ?? 0), 0);
  const totalsRow: string[] = ['', `Tot: ${money(totalAmount)}`, '', '', '', String(totalHits)];

  // Resumen sobre las jugadas recibidas: ya vienen con todos los filtros de la página aplicados.
  const winnerBets = bets.filter((b) => b.winner || Number(b.prize ?? 0) > 0);
  const totalPrize = winnerBets.reduce((acc, b) => acc + Number(b.prize ?? 0), 0);
  const ticketCount = new Set(bets.map((b) => b.ticket_id ?? b.ticket_number).filter(Boolean))
    .size;

  const allRows: string[][] = [...bets.map(betToRow), totalsRow];
  const totalsRowIndex = allRows.length - 1;

  // La primera página tiene menos filas porque lleva el resumen arriba de la tabla.
  const pages: { start: number; rows: number; top: number }[] = [];
  for (let start = 0, p = 0; start < allRows.length || p === 0; p++) {
    const rows = p === 0 ? FIRST_ROWS_PER_COL : ROWS_PER_COL;
    pages.push({ start, rows, top: p === 0 ? HEADER_H + SUMMARY_H : HEADER_H });
    start += rows * 2;
  }

  const headStyles = {
    halign: 'center' as const,
    fillColor: [255, 255, 255] as [number, number, number],
    textColor: [0, 0, 0] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: FS,
  };

  const columnStyles = {
    0: { cellWidth: COLS[0], halign: 'left' as const },
    1: { cellWidth: COLS[1], halign: 'right' as const },
    2: { cellWidth: COLS[2], halign: 'left' as const },
    3: { cellWidth: COLS[3], halign: 'left' as const },
    4: { cellWidth: COLS[4], halign: 'left' as const },
    5: { cellWidth: COLS[5], halign: 'right' as const },
  };

  const drawHeader = () => {
    doc.setFontSize(12);
    doc.text(grouped ? 'Jugadas Agrupadas' : 'Jugadas', pageW / 2, 11, { align: 'center' });

    doc.setFontSize(9);
    doc.text(`Fecha: ${dateStr}`, ML, 19);
    doc.text(`Impreso: ${printedAt}`, pageW - MR, 19, { align: 'right' });

    doc.setFontSize(8);
    doc.text(`Pasador: ${pasador}    Grupo: ${grupo}`, ML, 26);
    doc.text(`Turno: ${turno}    Lotería: ${loteria}`, ML, 32);

    doc.line(ML, 36, pageW - MR, 36);
  };

  const drawSummary = () => {
    const y = HEADER_H;
    doc.setFontSize(10);
    doc.text('Resumen', ML, y);
    doc.setFontSize(9);
    doc.text(`Apuestas: ${bets.length}    Monto total: $${money(totalAmount)}`, ML, y + 6);
    doc.text(`Premios: ${winnerBets.length}    Monto en premios: $${money(totalPrize)}`, ML, y + 12);
    // Agrupadas, cada fila junta jugadas de varios tickets: el conteo no aplica.
    if (!grouped) doc.text(`Tickets: ${ticketCount}`, ML, y + 18);
    doc.line(ML, y + SUMMARY_H - 3, pageW - MR, y + SUMMARY_H - 3);
  };

  pages.forEach(({ start: chunkStart, rows: perCol, top }, p) => {
    if (p > 0) doc.addPage();
    drawHeader();
    if (p === 0) drawSummary();

    const leftRows = allRows.slice(chunkStart, chunkStart + perCol);
    const rightRows = allRows.slice(chunkStart + perCol, chunkStart + perCol * 2);

    const makeDidParseCell = (colOffset: number) => (data: any) => {
      const globalIdx = chunkStart + colOffset + data.row.index;
      if (globalIdx === totalsRowIndex) {
        data.cell.styles.fontStyle = 'bold';
      }
    };

    // Columna izquierda
    if (leftRows.length > 0) {
      autoTable(doc, {
        startY: top,
        head,
        body: leftRows,
        theme: 'grid',
        margin: { left: ML, right: pageW - ML - halfW, top: 0, bottom: MB },
        styles: { fontSize: FS, cellPadding: CP },
        headStyles,
        columnStyles,
        tableWidth: halfW,
        didParseCell: makeDidParseCell(0),
      });
    }

    // Columna derecha
    if (rightRows.length > 0) {
      autoTable(doc, {
        startY: top,
        head,
        body: rightRows,
        theme: 'grid',
        margin: { left: ML + halfW + colGap, right: MR, top: 0, bottom: MB },
        styles: { fontSize: FS, cellPadding: CP },
        headStyles,
        columnStyles,
        tableWidth: halfW,
        didParseCell: makeDidParseCell(perCol),
      });
    }
  });

  // Footer paginación
  const totalDocPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalDocPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${totalDocPages}`,
      pageW - MR,
      pageH - 5,
      { align: 'right' }
    );
  }

  doc.save(`${grouped ? 'Jugadas-Agrupadas' : 'Jugadas'}-${date ?? dayjs().format('YYYY-MM-DD')}.pdf`);
}
