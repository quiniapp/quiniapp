import dayjs from 'dayjs';
import type { IBetEntityFront } from '@helper/types/bet.type';
import { betTypeAndPlaceLabel } from '@helper/functions/betTypeDictionary';

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
}) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const { bets, date } = opts;

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
  const ROWS_PER_COL = Math.floor((pageH - HEADER_H - MB - HEAD_H) / ROW_H) - 1;

  const dateStr = date ? dayjs(date).format('D/M/YYYY') : dayjs().format('D/M/YYYY');
  const printedAt = dayjs().format('D/M/YYYY HH:mm');

  const pasador = opts.cashierName || 'Todos';
  const grupo = opts.groupName || 'Todos';
  const turno = opts.scheduleName || 'Todos';
  const loteria = opts.lotteryName || 'Todos';

  const head = [['Jugada', 'Monto', 'Tipo', 'Turno', 'Quiniela', 'Aciert.']];

  const betToRow = (b: IBetEntityFront): string[] => [
    b.number + (b.with ? ` - ${b.with}` : ''),
    money(b.amount),
    betTypeAndPlaceLabel(b.bet_type, b.place, b.position),
    b.schedule?.name ?? '',
    b.lottery?.name ?? '',
    String(b.hits ?? 0),
  ];

  const totalAmount = bets.reduce((acc, b) => acc + (b.amount ?? 0), 0);
  const totalHits = bets.reduce((acc, b) => acc + (b.hits ?? 0), 0);
  const totalsRow: string[] = ['', `Tot: ${money(totalAmount)}`, '', '', '', String(totalHits)];

  const allRows: string[][] = [...bets.map(betToRow), totalsRow];
  const totalsRowIndex = allRows.length - 1;
  const totalPagesNeeded = Math.ceil(allRows.length / (ROWS_PER_COL * 2)) || 1;

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
    doc.text('Jugadas Agrupadas', pageW / 2, 11, { align: 'center' });

    doc.setFontSize(9);
    doc.text(`Fecha: ${dateStr}`, ML, 19);
    doc.text(`Impreso: ${printedAt}`, pageW - MR, 19, { align: 'right' });

    doc.setFontSize(8);
    doc.text(`Pasador: ${pasador}    Grupo: ${grupo}`, ML, 26);
    doc.text(`Turno: ${turno}    Lotería: ${loteria}`, ML, 32);

    doc.line(ML, 36, pageW - MR, 36);
  };

  for (let p = 0; p < totalPagesNeeded; p++) {
    if (p > 0) doc.addPage();
    drawHeader();

    const chunkStart = p * ROWS_PER_COL * 2;
    const leftRows = allRows.slice(chunkStart, chunkStart + ROWS_PER_COL);
    const rightRows = allRows.slice(chunkStart + ROWS_PER_COL, chunkStart + ROWS_PER_COL * 2);

    const makeDidParseCell = (colOffset: number) => (data: any) => {
      const globalIdx = chunkStart + colOffset + data.row.index;
      if (globalIdx === totalsRowIndex) {
        data.cell.styles.fontStyle = 'bold';
      }
    };

    // Columna izquierda
    if (leftRows.length > 0) {
      autoTable(doc, {
        startY: HEADER_H,
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
        startY: HEADER_H,
        head,
        body: rightRows,
        theme: 'grid',
        margin: { left: ML + halfW + colGap, right: MR, top: 0, bottom: MB },
        styles: { fontSize: FS, cellPadding: CP },
        headStyles,
        columnStyles,
        tableWidth: halfW,
        didParseCell: makeDidParseCell(ROWS_PER_COL),
      });
    }
  }

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

  doc.save(`Jugadas-Agrupadas-${date ?? dayjs().format('YYYY-MM-DD')}.pdf`);
}
