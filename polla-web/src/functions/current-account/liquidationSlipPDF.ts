import dayjs from 'dayjs';
import { IPollaCurrentAccountEntityFront } from '@helper/polla/types/game.type';
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

/**
 * Liquidación de cada pasador en una hoja, como `printLiquidationCashier` de
 * QuiniApp: datos de la cuenta del día y las jugadas que ganaron ese día. Sin
 * deje. Varias cuentas salen en un solo PDF, una por página.
 */
export async function downloadLiquidationSlipsPDF(params: {
  accounts: IPollaCurrentAccountEntityFront[];
  winnersByCashier: Map<string, SlipWinner[]>;
}) {
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

  params.accounts.forEach((account, index) => {
    if (index > 0) doc.addPage();

    const dateStr = dayjs(account.date).format('D/M/YYYY');

    doc.setFontSize(11);
    doc.text(`Nro: ${account.user_number ?? ''}`, margin.left, 14);
    doc.text(`Nombre: ${account.user_name ?? ''}`, margin.left + usableW / 2, 14, {
      align: 'center',
    });
    doc.text(`Fecha ${dateStr}`, margin.left + usableW, 14, { align: 'right' });
    doc.line(margin.left, 18, margin.left + usableW, 18);

    autoTable(doc, {
      startY: 22,
      body: [
        [
          `Pase: ${amount(account.pass)}`,
          `Aciertos: ${amount(account.successes)}`,
          `Reclamos: ${amount(account.claims)}`,
        ],
        [
          `Subtotal: ${amount(account.subtotal)}`,
          `Saldo: ${amount(account.previous_balance)}`,
          `Cobré: ${amount(account.collections)}`,
        ],
        [
          `Pagué: ${amount(account.paid)}`,
          `Comisión: ${amount(account.cashier_commission)}`,
          `Gastos: ${amount(account.bills)}`,
        ],
      ],
      theme: 'grid',
      margin,
      styles: { fontSize: 11, cellPadding: 3, halign: 'left' },
      columnStyles: threeColumns,
      tableWidth: usableW,
    });

    let y = lastTableY(doc, 22);
    doc.line(margin.left, y + 4, margin.left + usableW, y + 4);

    const total = Number(account.total);
    autoTable(doc, {
      startY: y + 8,
      body: [
        [
          `Deja: ${amount(account.revenue)}`,
          `Subtotal: ${amount(account.subtotal)}`,
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

    const winners = params.winnersByCashier.get(account.polla_user_id) ?? [];
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
  });

  addFooterPageNumbers(doc);

  const first = params.accounts[0];
  const dateFile = dayjs(first?.date).format('DD-MM-YYYY');
  const who = params.accounts.length === 1 ? `_${first.user_name}-${first.user_number ?? ''}` : '';
  doc.save(`Exportar_Liquidacion_${dateFile}${who}.pdf`);
}
