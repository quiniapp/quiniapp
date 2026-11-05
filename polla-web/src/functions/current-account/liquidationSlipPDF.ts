import dayjs from 'dayjs';
import { AccountPeriodView, periodLabel } from '@/lib/accountPeriod';
import { PdfDoc, addFooterPageNumbers, getPDFDeps, lastTableY } from './pdf-shared';

/** Jugada ganadora del día de un pasador, tal como va en la liquidación. */
export interface SlipWinner {
  ticket_number: string;
  /** Jugador (o el pasador, si la jugó él). */
  player: string;
  hits: number;
  prize: number;
}

const amount = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Pausa entre descargas: el navegador puede descartar las que salen juntas. */
const DOWNLOAD_GAP_MS = 300;

/** Los montos que imprime la hoja de un pasador (los acumulados de su período). */
export const liquidationSlipAmounts = (account: AccountPeriodView) => ({
  bets_pass: Number(account.bets_pass ?? 0),
  deleted_pass: Number(account.deleted_pass ?? 0),
  pass: Number(account.pass ?? 0),
  successes: Number(account.successes ?? 0),
  claims: Number(account.claims ?? 0),
  subtotal: Number(account.subtotal ?? 0),
  previous_balance: Number(account.previous_balance ?? 0),
  collections: Number(account.collections ?? 0),
  paid: Number(account.paid ?? 0),
  cashier_commission: Number(account.cashier_commission ?? 0),
  bills: Number(account.bills ?? 0),
  revenue: Number(account.revenue ?? 0),
  total: Number(account.total ?? 0),
});

/** Lo que se mira para decidir si un pasador tuvo movimiento en el período. */
const MOVEMENT_KEYS = [
  'bets_pass',
  'deleted_pass',
  'pass',
  'previous_balance',
  'collections',
  'paid',
  // Un premio, un reclamo o un gasto sin pase dejan el total distinto de 0:
  // hay plata que liquidar.
  'total',
] as const;

/**
 * Con movimiento: algo en el pase, las borradas, el saldo anterior, los cobros,
 * los pagos o el total. Los que no tienen nada vienen sin tildar al exportar.
 */
export const hasAccountMovement = (account: AccountPeriodView) => {
  const amounts = liquidationSlipAmounts(account);
  return MOVEMENT_KEYS.some((key) => amounts[key] !== 0);
};

/**
 * `polla_Exportar_Liquidacion_05-11-2026_Pedro-2-5.pdf`: fecha, nombre y el
 * pasador como `{grupo}-{número}` (el número se repite entre grupos). Sin los
 * caracteres que no admite un nombre de archivo.
 */
export const liquidationFileName = (account: AccountPeriodView, cashierCode: string) => {
  const dateFile = dayjs(account.date).format('DD-MM-YYYY');
  const name = `${account.user_name ?? ''}${cashierCode ? `-${cashierCode}` : ''}`
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim();
  return `polla_Exportar_Liquidacion_${dateFile}_${name}.pdf`;
};

/** Hoja de liquidación de un pasador. */
async function buildLiquidationSlipPDF(account: AccountPeriodView, winners: SlipWinner[]) {
  const { jsPDF, autoTable } = await getPDFDeps();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as PdfDoc;

  const margin = { left: 14, right: 14 };
  const usableW = doc.internal.pageSize.getWidth() - margin.left - margin.right;
  const col3 = usableW / 3;
  const threeColumns = {
    0: { cellWidth: col3 },
    1: { cellWidth: col3 },
    2: { cellWidth: col3 },
  };

  const dateStr = periodLabel(account.period_from, account.date, 'D/M/YYYY');

  doc.setFontSize(11);
  doc.text(`Nro: ${account.user_number ?? ''}`, margin.left, 14);
  doc.text(`Nombre: ${account.user_name ?? ''}`, margin.left + usableW / 2, 14, {
    align: 'center',
  });
  doc.text(
    `${account.period_from === account.date ? 'Fecha' : 'Período'} ${dateStr}`,
    margin.left + usableW,
    14,
    { align: 'right' }
  );
  doc.line(margin.left, 18, margin.left + usableW, 18);

  const a = liquidationSlipAmounts(account);

  autoTable(doc, {
    startY: 22,
    body: [
      // Pase jugadas − Borradas = Pase (más los reclamos positivos).
      [
        `Pase jugadas: ${amount(a.bets_pass)}`,
        `Borradas: ${amount(a.deleted_pass)}`,
        `Pase: ${amount(a.pass)}`,
      ],
      [
        `Aciertos: ${amount(a.successes)}`,
        `Reclamos: ${amount(a.claims)}`,
        `Subtotal: ${amount(a.subtotal)}`,
      ],
      [
        `Saldo: ${amount(a.previous_balance)}`,
        `Cobré: ${amount(a.collections)}`,
        `Pagué: ${amount(a.paid)}`,
      ],
      [`Comisión: ${amount(a.cashier_commission)}`, `Gastos: ${amount(a.bills)}`, ''],
    ],
    theme: 'grid',
    margin,
    styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
    columnStyles: threeColumns,
    tableWidth: usableW,
  });

  let y = lastTableY(doc, 22);
  doc.line(margin.left, y + 4, margin.left + usableW, y + 4);

  const total = a.total;
  autoTable(doc, {
    startY: y + 8,
    body: [
      [
        `Deja: ${amount(a.revenue)}`,
        `Subtotal: ${amount(a.subtotal)}`,
        `${total > 0 ? 'Debe' : 'Cobra'}: ${amount(Math.abs(total))}`,
      ],
    ],
    theme: 'grid',
    margin,
    styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
    columnStyles: threeColumns,
    tableWidth: usableW,
  });

  y = lastTableY(doc, y);
  doc.line(margin.left, y + 4, margin.left + usableW, y + 4);
  doc.setFontSize(11);
  doc.text('Jugadas ganadoras', margin.left, y + 10);

  const widths = [0.35, 0.35, 0.12, 0.18].map((w) => w * usableW);

  autoTable(doc, {
    startY: y + 14,
    head: [['Ticket', 'Jugador', 'Aciertos', 'Premio']],
    body: winners.length
      ? winners.map((w) => [w.ticket_number, w.player, String(w.hits), amount(w.prize)])
      : [['Sin jugadas ganadoras', '', '', '']],
    theme: 'grid',
    margin,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: widths[0], halign: 'left' },
      1: { cellWidth: widths[1], halign: 'left' },
      2: { cellWidth: widths[2], halign: 'right' },
      3: { cellWidth: widths[3], halign: 'right' },
    },
    tableWidth: usableW,
  });

  addFooterPageNumbers(doc);
  return doc;
}

/**
 * Liquidación de cada pasador, como `printLiquidationCashier` de QuiniApp: lo
 * acumulado en su período (desde el día siguiente a la última liquidación) y
 * las jugadas que ganaron en ese período. Sin deje. Se descarga un PDF por
 * pasador (descargas separadas, igual que "Exportar liquidación" de QuiniApp),
 * solo de los que se eligieron. `cashierCodeOf` da el `{grupo}-{número}` del
 * nombre de archivo.
 */
export async function downloadLiquidationSlipsPDF(params: {
  accounts: AccountPeriodView[];
  winnersByCashier: Map<string, SlipWinner[]>;
  cashierCodeOf: (account: AccountPeriodView) => string;
}) {
  for (const [index, account] of params.accounts.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_GAP_MS));

    const winners = params.winnersByCashier.get(account.polla_user_id) ?? [];
    const doc = await buildLiquidationSlipPDF(account, winners);
    doc.save(liquidationFileName(account, params.cashierCodeOf(account)));
  }
}
