import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import {
  IPollaBetEntityBack,
  IPollaEditionEntityFront,
  pollaEditionDrawLabels,
  pollaEditionTitle,
  pollaTicketCashierCode,
} from '@helper/polla/types/game.type';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { PollaTicketData, makePollaTicketsPdf } from '@/functions/makePollaTicket';
import { deliverPdf, sharePdf } from '@/functions/printPdf';

/** Lo que el ticket impreso necesita de la jugada. */
export type TicketBet = Pick<
  IPollaBetEntityBack,
  | 'ticket_number'
  | 'user_name'
  | 'identifier'
  | 'cashier_number'
  | 'numbers'
  | 'load_date'
  | 'amount'
  | 'is_free'
  | 'payment_status'
  | 'created_at'
  | 'winner'
>;

const fmtDate = (value: string) => dayjs(value).format('DD-MM-YYYY');
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

/**
 * Impresión de los tickets recién cargados (cargar o repetir), igual en
 * Cargar jugada y en Administrar jugadas: un PDF con uno o varios. El pasador
 * y el staff lo imprimen (o lo comparten en el celular); el jugador lo guarda
 * o lo comparte; el Súper (R12) solo ve un aviso con los números de ticket.
 * `onPrinted` recibe los tickets antes de imprimir (lo último cargado).
 */
export const usePollaTicketPrinter = (onPrinted?: (bets: TicketBet[]) => void) => {
  const { role, organizationId } = useAuth();
  const catalogs = useDrawCatalogs(organizationId);
  const isPlayer = role === POLLA_USER_TYPE.PLAYER;
  const isAssistant = role === POLLA_USER_TYPE.ASSISTANT;

  const ticketDataOf = (bet: TicketBet, of: IPollaEditionEntityFront): PollaTicketData => ({
    ticket_number: bet.ticket_number,
    user_name: bet.user_name,
    identifier: bet.identifier,
    cashier_code: pollaTicketCashierCode(bet.ticket_number, bet.cashier_number) || undefined,
    numbers: bet.numbers,
    editionName: of.name,
    drawLines: pollaEditionDrawLabels(of, catalogs),
    startDate: of.start_date,
    endDate: of.end_date,
    loadDate: bet.load_date,
    loadedAt: bet.created_at,
    ticketPrice: Number(bet.amount),
    poolAmount: Number(of.pool_amount),
    surprisePoolAmount: Number(of.surprise_pool_amount ?? 0),
    isFree: Boolean(bet.is_free),
    // El ticket del jugador no dice si está pagado.
    paymentStatus: isPlayer ? undefined : bet.payment_status,
  });

  const printTickets = async (bets: TicketBet[], of: IPollaEditionEntityFront) => {
    if (bets.length === 0) return;
    onPrinted?.(bets);
    // R12: el Súper carga planillas en serie. No se abre la impresión: un
    // aviso con el número de ticket (lo puede reimprimir desde Administrar).
    if (isAssistant) {
      toast.success(
        bets.length === 1
          ? `Ticket ${bets[0].ticket_number} cargado`
          : `${bets.length} tickets cargados: ${bets.map((bet) => bet.ticket_number).join(', ')}`,
        { duration: 6000 }
      );
      return;
    }
    const { blob, fileName } = await makePollaTicketsPdf(bets.map((bet) => ticketDataOf(bet, of)));
    const text =
      bets.length === 1 ? `Ticket Polla ${bets[0].ticket_number}` : `${bets.length} tickets Polla`;
    if (isPlayer) {
      await sharePdf(blob, fileName, text);
      return;
    }
    await deliverPdf(blob, fileName, text);
  };

  /** Edición destino en "Repetir": título, fechas y precio del ticket. */
  const editionLabel = (item: IPollaEditionEntityFront) =>
    `${pollaEditionTitle(item, catalogs)} (${fmtDate(item.start_date)} al ${fmtDate(
      item.end_date
    )}) · $${fmtMoney(item.ticket_price)}`;

  return { printTickets, ticketDataOf, editionLabel, prints: !isAssistant };
};
