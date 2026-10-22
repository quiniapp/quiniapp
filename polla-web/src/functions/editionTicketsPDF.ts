import dayjs from 'dayjs';
import {
  IPollaBetListItem,
  IPollaEditionEntityFront,
  POLLA_NUMBERS_REQUIRED,
} from '@helper/polla/types/game.type';
import {
  PdfDoc,
  addFooterPageNumbers,
  getPDFDeps,
  gridTableOptions,
  lastTableY,
} from './current-account/pdf-shared';

const FONT_SIZE = 7;
const CELL_PAD = 1;
const MARGIN = { left: 10, right: 10 };
/** Gris claro: en blanco y negro se distingue sin tapar el número. */
const HIT_FILL: [number, number, number] = [205, 205, 205];
const NUMBER_COLUMNS = Array.from({ length: POLLA_NUMBERS_REQUIRED }, (_, i) => i);
/** Ticket, Pasador y Cliente van antes de los números. */
const FIRST_NUMBER_COLUMN = 3;

const money = (n: number) =>
  `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(n) || 0)}`;

const fmtDate = (value: string) => dayjs(value).format('DD/MM/YYYY');

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_');

export interface EditionTicketsPdfParams {
  rows: IPollaBetListItem[];
  edition: IPollaEditionEntityFront;
  lotteryName: string;
  scheduleName: string;
  orgName?: string;
  /** Qué filtros se aplicaron (pasador, mis jugadas, orden). */
  filtersLabel?: string;
}

/**
 * Tickets de una edición para compartir, pensado para imprimir en blanco y
 * negro: los números acertados van en negrita y sombreados, y hay columnas con
 * los aciertos, si ganó y cuánto. Una fila por ticket, aunque sean miles.
 */
export async function makeEditionTicketsPdf(params: EditionTicketsPdfParams) {
  const { rows, edition, lotteryName, scheduleName, orgName, filtersLabel } = params;
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as PdfDoc;

  const available = doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right;
  const title = `Polla ${lotteryName} · ${scheduleName}`;
  const winners = rows.filter((row) => row.winner);
  const prizes = winners.reduce((acc, row) => acc + Number(row.prize), 0);

  doc.setProperties({ title });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(orgName ? `${orgName} · ${title}` : title, MARGIN.left, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    [
      `Juega del ${fmtDate(edition.start_date)} al ${fmtDate(edition.end_date)} · Pozo ${money(
        edition.pool_amount
      )}${
        Number(edition.surprise_pool_amount ?? 0) > 0
          ? ` + sorpresa ${money(edition.surprise_pool_amount)}`
          : ''
      } · Valor del ticket ${money(edition.ticket_price)}`,
      `${rows.length} tickets${filtersLabel ? ` · ${filtersLabel}` : ''} · Generado el ${dayjs().format(
        'DD/MM/YYYY HH:mm'
      )}`,
      winners.length
        ? `Ganadores: ${winners.length} · ${money(prizes)} en premios`
        : 'Todavía no hay ganadores',
      'Números acertados en negrita y sombreados.',
    ],
    MARGIN.left,
    18
  );
  const startY = 36;

  // Anchos fijos para números y montos; lo que sobra se reparte entre los nombres.
  const fixed = { ticket: 34, number: 8.5, hits: 13, won: 10, prize: 22 };
  const nameWidth =
    (available -
      fixed.ticket -
      fixed.number * POLLA_NUMBERS_REQUIRED -
      fixed.hits -
      fixed.won -
      fixed.prize) /
    2;

  const centered = { halign: 'center' as const, overflow: 'hidden' as const };

  autoTable(doc, {
    ...gridTableOptions({
      fontSize: FONT_SIZE,
      cellPadding: CELL_PAD,
      margin: MARGIN,
      width: available,
      columnStyles: {
        0: { cellWidth: fixed.ticket, overflow: 'hidden' },
        1: { cellWidth: nameWidth, overflow: 'ellipsize' },
        2: { cellWidth: nameWidth, overflow: 'ellipsize' },
        ...Object.fromEntries(
          NUMBER_COLUMNS.map((slot) => [
            FIRST_NUMBER_COLUMN + slot,
            { cellWidth: fixed.number, ...centered },
          ])
        ),
        [FIRST_NUMBER_COLUMN + POLLA_NUMBERS_REQUIRED]: { cellWidth: fixed.hits, ...centered },
        [FIRST_NUMBER_COLUMN + POLLA_NUMBERS_REQUIRED + 1]: { cellWidth: fixed.won, ...centered },
        [FIRST_NUMBER_COLUMN + POLLA_NUMBERS_REQUIRED + 2]: {
          cellWidth: fixed.prize,
          halign: 'right',
          overflow: 'hidden',
        },
      },
    }),
    head: [
      [
        'Ticket',
        'Pasador',
        'Cliente',
        ...NUMBER_COLUMNS.map((slot) => String(slot + 1)),
        'Aciertos',
        'Ganó',
        'Premio',
      ],
    ],
    body: rows.map((row) => [
      row.ticket_number,
      `${row.cashier_number ? `${row.cashier_number} · ` : ''}${row.cashier_name}`,
      row.client_name ?? '',
      ...NUMBER_COLUMNS.map((slot) => row.numbers[slot] ?? ''),
      String(row.hits),
      row.winner ? 'SÍ' : '',
      row.winner ? money(row.prize) : '',
    ]),
    startY,
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;

      if (row.winner) data.cell.styles.fontStyle = 'bold';

      const slot = data.column.index - FIRST_NUMBER_COLUMN;
      if (slot >= 0 && slot < POLLA_NUMBERS_REQUIRED && row.hit_dates?.[slot]) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = HIT_FILL;
      }
    },
  });

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.text('No hay tickets con esos filtros.', MARGIN.left, lastTableY(doc, startY) + 8);
  }

  addFooterPageNumbers(doc);

  return {
    blob: doc.output('blob'),
    fileName: `Polla_${slug(lotteryName)}_${slug(scheduleName)}_${dayjs(edition.start_date).format(
      'DD-MM-YYYY'
    )}.pdf`,
  };
}
