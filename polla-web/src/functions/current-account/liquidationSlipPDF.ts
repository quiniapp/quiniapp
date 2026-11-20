import dayjs from 'dayjs';
import { AccountPeriodView, periodLabel } from '@/lib/accountPeriod';
import { owedWord } from '@/lib/editionAccount';
import { cashierLiquidationImageLines } from '@/lib/liquidationImageLines';
import { liquidationSlipAmounts } from '@/lib/liquidationSlip';
import {
  liquidationZipEntries,
  liquidationZipPdfName,
  zipRootFolder,
  type ZipGroup,
} from '@/lib/liquidationZip';
import type { LiquidationFormat, PreparedLiquidation } from './liquidationDelivery';
import { renderLiquidationImage } from './liquidationImage';
import { PdfDoc, addFooterPageNumbers, getPDFDeps, lastTableY } from './pdf-shared';

const amount = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
  /** `YYYY-MM-DD` de la liquidación: va en la carpeta del grupo y en el PDF. */
  date: string;
  /** Varias ediciones: carpeta de la edición dentro del ZIP. */
  edition?: { key: string; folder: string };
  /** Cuenta por edición: la cabecera derecha dice `Edición ${headerLabel}`. */
  headerLabel?: string;
}

/**
 * Liquidación de cada pasador, como `printLiquidationCashier` de QuiniApp: lo
 * acumulado en su período (desde el día siguiente a la última liquidación).
 * Sin deje ni premios (R18: los premios están en Premios). Un archivo por
 * pasador (PDF o imagen), solo de los elegidos, con su ruta en el ZIP: carpeta
 * raíz del mismo nombre y adentro carpetas por grupo (y por edición si hay
 * varias). `deliverLiquidation` lo entrega. Devuelve null si no hay hojas (no
 * arma un ZIP vacío).
 */
export async function prepareLiquidationSlips(params: {
  sheets: LiquidationSlipSheet[];
  zipName: string;
  format: LiquidationFormat;
}): Promise<PreparedLiquidation | null> {
  if (params.sheets.length === 0) return null;

  const entries = liquidationZipEntries(
    params.sheets.map((sheet) => {
      const pdfName = liquidationZipPdfName(sheet.cashierCode, sheet.account.user_name, sheet.date);
      return {
        ...sheet,
        fileName: params.format === 'image' ? pdfName.replace(/\.pdf$/, '.png') : pdfName,
      };
    }),
    zipRootFolder(params.zipName)
  );

  const files: PreparedLiquidation['files'] = [];
  for (const [index, { path, item }] of entries.entries()) {
    // Cede el hilo para que se pinte "Exportando…" en exportes grandes.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const blob =
      params.format === 'image'
        ? await renderLiquidationImage(
            cashierLiquidationImageLines({ account: item.account, headerLabel: item.headerLabel })
          )
        : (await buildLiquidationSlipPDF(item.account, item.headerLabel)).output('blob');
    files.push({ path, blob });
  }
  return { zipName: params.zipName, format: params.format, files };
}

/** Un solo pasador: baja el PDF suelto. */
export async function downloadLiquidationSlipPDF(params: {
  account: AccountPeriodView;
  cashierCode: string;
}) {
  const doc = await buildLiquidationSlipPDF(params.account);
  doc.save(liquidationFileName(params.account, params.cashierCode));
}
