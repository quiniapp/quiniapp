import { IPollaBetListItem } from '@helper/polla/types/game.type';
import { useBetsOfDay } from '@/hooks/fetchs/usePollaData';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtMoney } from './format';

interface DayBetsTablesProps {
  date: string;
  /** Admin: el pasador de la fila. El pasador mira lo suyo con `mine`. */
  cashierId?: string;
  enabled?: boolean;
}

const player = (bet: IPollaBetListItem) => bet.client_name ?? bet.cashier_name;

/**
 * Lo que se liquida de un pasador en el día, como en QuiniApp: los tickets que
 * cargó (el pase) y las jugadas que ganaron ese día (los premios).
 */
export const DayBetsTables = ({ date, cashierId, enabled = true }: DayBetsTablesProps) => {
  const scope = cashierId ? { cashier_polla_user_id: cashierId } : { mine: true };

  const { data: tickets, isFetching: loadingTickets } = useBetsOfDay(
    { ...scope, load_date: date },
    enabled
  );
  const { data: winners, isFetching: loadingWinners } = useBetsOfDay(
    { ...scope, hit_date: date, winners: true },
    enabled
  );

  const empty = (loading: boolean, message: string, colSpan: number) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
        {loading ? 'Cargando…' : message}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-1">
        <h3 className="text-sm font-semibold">Tickets del día</h3>
        <div className="max-h-60 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.data.length
                ? tickets.data.map((bet) => (
                    <TableRow key={bet.polla_bet_id}>
                      <TableCell className="font-mono text-xs">{bet.ticket_number}</TableCell>
                      <TableCell>{player(bet)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {bet.amount !== null ? `$${fmtMoney(bet.amount)}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                : empty(loadingTickets, 'No cargó tickets ese día', 3)}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-1">
        <h3 className="text-sm font-semibold">Jugadas ganadoras</h3>
        <div className="max-h-60 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead className="text-right">Aciertos</TableHead>
                <TableHead className="text-right">Premio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {winners?.data.length
                ? winners.data.map((bet) => (
                    <TableRow key={bet.polla_bet_id}>
                      <TableCell className="font-mono text-xs">{bet.ticket_number}</TableCell>
                      <TableCell>{player(bet)}</TableCell>
                      <TableCell className="text-right tabular-nums">{bet.hits}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${fmtMoney(bet.prize)}
                      </TableCell>
                    </TableRow>
                  ))
                : empty(loadingWinners, 'Sin jugadas ganadoras ese día', 4)}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
};
