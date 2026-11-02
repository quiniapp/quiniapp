import dayjs from 'dayjs';
import { IPollaBetListItem } from '@helper/polla/types/game.type';
import { Badge } from '@/components/ui/badge';
import { useBetsOfDay } from '@/hooks/fetchs/usePollaData';
import { betsRangeFrom } from '@/lib/accountPeriod';
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
  /** Período que se liquida (el mismo día si arranca y termina ahí). */
  from: string;
  to: string;
  /** Admin: el pasador de la fila. El pasador mira lo suyo con `mine`. */
  cashierId?: string;
  enabled?: boolean;
}

const player = (bet: IPollaBetListItem) => bet.client_name ?? bet.identifier ?? bet.cashier_name;

const money = (bet: IPollaBetListItem) => (bet.amount !== null ? `$${fmtMoney(bet.amount)}` : '-');

/**
 * Lo que se liquida de un pasador en el período, como en QuiniApp: los tickets
 * que cargó (el pase de jugadas, con los que se borraron después), las
 * borradas que se descuentan en el período y las jugadas que ganaron (los
 * premios). Tickets − borradas = pase.
 */
export const DayBetsTables = ({ from, to, cashierId, enabled = true }: DayBetsTablesProps) => {
  const scope = cashierId ? { cashier_polla_user_id: cashierId } : { mine: true };
  const span = from === to ? 'del día' : 'del período';
  const rangeFrom = betsRangeFrom(from, to);

  const { data: tickets, isFetching: loadingTickets } = useBetsOfDay(
    { ...scope, load_from: rangeFrom, load_to: to, with_deducted: true },
    enabled
  );
  const { data: deleted, isFetching: loadingDeleted } = useBetsOfDay(
    { ...scope, deducted_from: rangeFrom, deducted_to: to },
    enabled
  );
  const { data: winners, isFetching: loadingWinners } = useBetsOfDay(
    { ...scope, hit_from: rangeFrom, hit_to: to, winners: true },
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
        <h3 className="text-sm font-semibold">Tickets {span}</h3>
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
                      <TableCell className="font-mono text-xs">
                        {bet.ticket_number}
                        {bet.deducted_on && (
                          <Badge variant="destructive" className="ml-1 font-sans">
                            Borrada {dayjs(bet.deducted_on).format('DD/MM')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{player(bet)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(bet)}</TableCell>
                    </TableRow>
                  ))
                : empty(loadingTickets, `No cargó tickets ${span}`, 3)}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-1">
        <h3 className="text-sm font-semibold">Jugadas ganadoras {span}</h3>
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
                : empty(loadingWinners, `Sin jugadas ganadoras ${span}`, 4)}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-1 md:col-span-2">
        <h3 className="text-sm font-semibold">Borradas {span}</h3>
        <div className="max-h-60 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Cargada</TableHead>
                <TableHead>Borrada</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deleted?.data.length
                ? deleted.data.map((bet) => (
                    <TableRow key={bet.polla_bet_id}>
                      <TableCell className="font-mono text-xs">{bet.ticket_number}</TableCell>
                      <TableCell>{player(bet)}</TableCell>
                      <TableCell className="tabular-nums">
                        {dayjs(bet.load_date).format('DD/MM')}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {bet.deducted_on ? dayjs(bet.deducted_on).format('DD/MM') : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(bet)}</TableCell>
                    </TableRow>
                  ))
                : empty(loadingDeleted, `Sin jugadas borradas ${span}`, 5)}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
};
