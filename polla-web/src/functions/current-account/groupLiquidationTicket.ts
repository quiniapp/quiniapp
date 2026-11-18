import dayjs from 'dayjs';
import {
  IPollaGroupAccountEntityFront,
  IPollaGroupEditionAccountEntity,
} from '@helper/polla/types/game.type';
import { groupSplit } from '@/lib/editionAccount';
import { openPDFPrintDialog } from './pdf-shared';

/**
 * Tickets térmicos de 58 mm de la liquidación de un grupo, con el mismo
 * formato que los de cobros y pagos (`totalsTicket.ts`): el de la cuenta por
 * edición y el del Historial por fechas.
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

const pageHeight = (lines: string[]) => Math.max(80, lines.length * LINE_H + MARGIN * 2 + 4);

/**
 * Arma el PDF de 58 mm (una página por ticket) y abre el diálogo de
 * impresión: así cada grupo sale cortado aparte.
 */
async function printTicketPages(pages: string[][], title: string) {
  if (pages.length === 0) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAPER_W, pageHeight(pages[0])],
  });

  doc.setProperties({ title });
  pages.forEach((lines, index) => {
    if (index > 0) doc.addPage([PAPER_W, pageHeight(lines)], 'portrait');
    doc.setFont('courier', 'normal');
    doc.setFontSize(FONT_SIZE);
    let y = MARGIN + 4;
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += LINE_H;
    }
  });

  openPDFPrintDialog(doc, title);
}

/** Un solo ticket. */
const printTicketLines = (lines: string[], title: string) => printTicketPages([lines], title);

export type GroupEditionTicketAccount = Pick<
  IPollaGroupEditionAccountEntity,
  'group_name' | 'cashiers_subtotal' | 'expenses' | 'base' | 'admin_percentage' | 'admin_commission'
>;

/**
 * Renglones del ticket de la liquidación de un grupo en una edición: el total
 * (lo que dejaron los pasadores menos los gastos) y cuánto es para el admin
 * (el 100% de su comisión) y para el capitalista. Sin ajustes ni pagado.
 */
export const groupEditionTicketLines = (params: {
  account: GroupEditionTicketAccount;
  orgName: string;
  /** Título de la edición. */
  periodText: string;
  /** `HH:mm` de la impresión. */
  time: string;
}): string[] => {
  const { account, orgName, periodText, time } = params;
  const split = groupSplit(account.base, account.admin_commission);
  const lines: string[] = [];
  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  lines.push(centerLine(account.group_name.toUpperCase()));
  lines.push(centerLine('LIQUIDACION DEL GRUPO'));
  lines.push(centerLine(periodText));
  lines.push(centerLine(`HORA: ${time}`));
  lines.push(DIVIDER);
  lines.push(padLine('Deja pasadores:', money(account.cashiers_subtotal)));
  // `|| 0`: sin gastos no imprime "$-0".
  lines.push(padLine('Gastos del grupo:', money(-Number(account.expenses) || 0)));
  lines.push(padLine('TOTAL:', money(account.base)));
  lines.push(DIVIDER);
  lines.push(padLine('% ADMIN:', `${Number(account.admin_percentage)}%`));
  lines.push(padLine('TOTAL ADMIN:', money(split.admin)));
  lines.push(padLine('TOTAL CAPITALISTA:', money(split.capitalist)));
  // Mismo relleno que los demás tickets: vacía el buffer de la impresora.
  lines.push(DIVIDER);
  lines.push(DIVIDER);
  lines.push(DIVIDER);
  return lines;
};

/** Ticket de la liquidación de un grupo en una edición. */
export async function printGroupEditionLiquidationTicket(params: {
  account: GroupEditionTicketAccount;
  orgName: string;
  periodText: string;
}) {
  const { account, periodText } = params;
  const lines = groupEditionTicketLines({ ...params, time: dayjs().format('HH:mm') });
  const title = `polla_Liquidacion_${account.group_name.trim().replace(/\s+/g, '_')}_${periodText.trim().replace(/\s+/g, '_')}`;
  await printTicketLines(lines, title);
}

/**
 * "Liquidar seleccionados": los tickets de varios grupos de la edición en un
 * solo PDF, una página por grupo.
 */
export async function printGroupEditionLiquidationTickets(params: {
  accounts: GroupEditionTicketAccount[];
  orgName: string;
  periodText: string;
}) {
  const { accounts, orgName, periodText } = params;
  if (accounts.length === 1) {
    await printGroupEditionLiquidationTicket({ account: accounts[0], orgName, periodText });
    return;
  }
  const time = dayjs().format('HH:mm');
  const pages = accounts.map((account) =>
    groupEditionTicketLines({ account, orgName, periodText, time })
  );
  const title = `polla_Liquidacion_grupos_${periodText.trim().replace(/\s+/g, '_')}`;
  await printTicketPages(pages, title);
}

/** Ticket de una liquidación de grupo del Historial por fechas (con arrastre y saldo). */
export async function printGroupLiquidationTicket(params: {
  account: IPollaGroupAccountEntityFront;
  orgName: string;
}) {
  const { account, orgName } = params;

  const lines: string[] = [];
  if (orgName) lines.push(centerLine(orgName.toUpperCase()));
  lines.push(centerLine(account.group_name.toUpperCase()));
  lines.push(centerLine('LIQUIDACION DEL GRUPO'));
  lines.push(
    centerLine(
      `${dayjs(account.period_from).format('DD/MM/YYYY')} AL ${dayjs(account.date).format('DD/MM/YYYY')}`
    )
  );
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

  const title = `polla_Liquidacion_${account.group_name.trim().replace(/\s+/g, '_')}_${dayjs(account.date).format('DD-MM-YYYY')}`;
  await printTicketLines(lines, title);
}
