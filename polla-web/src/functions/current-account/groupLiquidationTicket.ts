import dayjs from 'dayjs';
import { IPollaGroupAccountEntityFront } from '@helper/polla/types/game.type';
import { openPDFPrintDialog } from './pdf-shared';

/**
 * Ticket térmico de 58 mm de la liquidación de un grupo, con el mismo formato
 * que los de cobros y pagos (`totalsTicket.ts`).
 */

const PAPER_W = 58;
const CHARS = 32;
const MARGIN = 3;
const FONT_SIZE = 8;
const LINE_H = 4;

const money = (n: number | null | undefined) =>
  '$' +
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Number.isFinite(Number(n)) ? Number(n) : 0
  );

const padLine = (label: string, amount: string) =>
  label + ' '.repeat(Math.max(1, CHARS - label.length - amount.length)) + amount;

const centerLine = (text: string) =>
  ' '.repeat(Math.max(0, Math.floor((CHARS - text.length) / 2))) + text;

const DIVIDER = '- '.repeat(CHARS / 2);

export async function printGroupLiquidationTicket(params: {
  account: IPollaGroupAccountEntityFront;
  orgName: string;
}) {
  const { account, orgName } = params;
  const { jsPDF } = await import('jspdf');

  const fromStr = dayjs(account.period_from).format('DD/MM/YYYY');
  const toStr = dayjs(account.date).format('DD/MM/YYYY');

  const lines: string[] = [];
  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  lines.push(centerLine(account.group_name.toUpperCase()));
  lines.push(centerLine('LIQUIDACION DEL GRUPO'));
  lines.push(centerLine(`${fromStr} AL ${toStr}`));
  lines.push(centerLine(`HORA: ${dayjs().format('HH:mm')}`));
  lines.push(DIVIDER);
  lines.push(padLine('Deja pasadores:', money(account.cashiers_subtotal)));
  lines.push(padLine('Gastos del grupo:', money(-account.expenses)));
  if (Number(account.previous_drag) !== 0) {
    lines.push(padLine('Arrastre anterior:', money(account.previous_drag)));
  }
  lines.push(padLine('BASE:', money(account.drag_base)));
  lines.push(DIVIDER);
  lines.push(
    padLine(`${Number(account.admin_percentage)}% ADMIN:`, money(account.admin_commission))
  );
  if (Number(account.drag) !== 0) {
    lines.push(padLine('Arrastra:', money(account.drag)));
  }
  lines.push(DIVIDER);
  lines.push(padLine('Saldo anterior:', money(account.previous_balance)));
  if (Number(account.adjustments) !== 0) {
    lines.push(padLine('Ajustes:', money(account.adjustments)));
  }
  lines.push(padLine('Pagado al admin:', money(-account.paid)));
  lines.push(padLine('TOTAL ADMIN:', money(account.total)));
  // Mismo relleno que los demás tickets: vacía el buffer de la impresora.
  lines.push(DIVIDER);
  lines.push(DIVIDER);
  lines.push(DIVIDER);

  const docHeight = Math.max(80, lines.length * LINE_H + MARGIN * 2 + 4);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAPER_W, docHeight] });
  const title = `Liquidacion_${account.group_name.trim().replace(/\s+/g, '_')}_${dayjs(account.date).format('DD-MM-YYYY')}`;

  doc.setProperties({ title });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let y = MARGIN + 4;
  for (const line of lines) {
    doc.text(line, MARGIN, y);
    y += LINE_H;
  }

  openPDFPrintDialog(doc, title);
}
