import dayjs from 'dayjs';
import { AccountPeriodView, periodLabel } from '@/lib/accountPeriod';
import { owedWord } from '@/lib/editionAccount';
import {
  liquidationZipEntries,
  liquidationZipPdfName,
  zipFiles,
  type ZipGroup,
} from '@/lib/liquidationZip';
import { shareFile } from '../printPdf';
import { PdfDoc, addFooterPageNumbers, getPDFDeps, lastTableY } from './pdf-shared';

const amount = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Los montos que imprime la hoja de un pasador (los acumulados de su período).
 * Sin premios: no van en la cuenta corriente (R18), están en Premios.
 */
export const liquidationSlipAmounts = (account: AccountPeriodView) => ({
  bets_pass: Number(account.bets_pass ?? 0),
  deleted_pass: Number(account.deleted_pass ?? 0),
  pass: Number(account.pass ?? 0),
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
  // Un reclamo sin pase (o un premio de un período ya liquidado) deja el
  // total distinto de 0: hay plata que liquidar.
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
export const liquidationFileName = (
  account: AccountPeriodView,
  cashierCode: string,
  /** Lo que va en lugar de la fecha (la edición). */
  tag?: string
) => {
  const dateFile = tag ?? dayjs(account.date).format('DD-MM-YYYY');
  const name = `${account.user_name ?? ''}${cashierCode ? `-${cashierCode}` : ''}`
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim();
  return `polla_Exportar_Liquidacion_${dateFile}_${name}.pdf`;
};

/** Hoja de liquidación de un pasador. */
async function buildLiquidationSlipPDF(account: AccountPeriodView, headerLabel?: string) {
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
    headerLabel !== undefined
      ? `Edición ${headerLabel}`
      : `${account.period_from === account.date ? 'Fecha' : 'Período'} ${dateStr}`,
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
        `Comisión: ${amount(a.cashier_commission)}`,
        `Reclamos: ${amount(a.claims)}`,
        `Subtotal: ${amount(a.subtotal)}`,
      ],
      [
        `Saldo: ${amount(a.previous_balance)}`,
        `Cobré: ${amount(a.collections)}`,
        `Pagué: ${amount(a.paid)}`,
      ],
      [`Gastos: ${amount(a.bills)}`, '', ''],
    ],
    theme: 'grid',
    margin,
    styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
    columnStyles: threeColumns,
    tableWidth: usableW,
  });

  const y = lastTableY(doc, 22);
  doc.line(margin.left, y + 4, margin.left + usableW, y + 4);

  const total = a.total;
  autoTable(doc, {
    startY: y + 8,
    body: [
      [
        `Deja: ${amount(a.revenue)}`,
        `Subtotal: ${amount(a.subtotal)}`,
        `${owedWord(total)}: ${amount(Math.abs(total))}`,
      ],
    ],
    theme: 'grid',
    margin,
    styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
    columnStyles: threeColumns,
    tableWidth: usableW,
  });

  addFooterPageNumbers(doc);
  return doc;
}

export interface LiquidationSlipSheet {
  account: AccountPeriodView;
  /** `{grupo}-{número}` del nombre de archivo. */
  cashierCode: string;
  group?: ZipGroup;
  /** Varias ediciones: carpeta de la edición dentro del ZIP. */
  edition?: { key: string; folder: string };
  /** Cuenta por edición: la cabecera derecha dice `Edición ${headerLabel}`. */
  headerLabel?: string;
}

/**
 * Liquidación de cada pasador, como `printLiquidationCashier` de QuiniApp: lo
 * acumulado en su período (desde el día siguiente a la última liquidación).
 * Sin deje ni premios (R18: los premios están en Premios). Un PDF por pasador,
 * solo de los elegidos, todos en un ZIP con carpetas por grupo (y por edición
 * si hay varias). En el celular se comparte; si no, se descarga. Devuelve
 * false si no hay hojas (no arma un ZIP vacío).
 */
export async function exportLiquidationSlipsZip(params: {
  sheets: LiquidationSlipSheet[];
  zipName: string;
}) {
  if (params.sheets.length === 0) return false;

  const entries = liquidationZipEntries(
    params.sheets.map((sheet) => ({
      ...sheet,
      fileName: liquidationZipPdfName(sheet.cashierCode, sheet.account.user_name),
    }))
  );

  const files: { path: string; data: Uint8Array }[] = [];
  for (const [index, { path, item }] of entries.entries()) {
    // Cede el hilo para que se pinte "Exportando…" en exportes grandes.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const doc = await buildLiquidationSlipPDF(item.account, item.headerLabel);
    files.push({ path, data: new Uint8Array(doc.output('arraybuffer')) });
  }

  const blob = await zipFiles(files);
  await shareFile(blob, params.zipName, 'Liquidaciones de la Polla', 'application/zip');
  return true;
}

/** Un solo pasador: baja el PDF suelto. */
export async function downloadLiquidationSlipPDF(params: {
  account: AccountPeriodView;
  cashierCode: string;
}) {
  const doc = await buildLiquidationSlipPDF(params.account);
  doc.save(liquidationFileName(params.account, params.cashierCode));
}
