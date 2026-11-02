import { ReactNode, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  IPollaTicketCheck,
  IPollaTicketHolder,
  POLLA_EDITION_STATUS,
  POLLA_TICKET_SEARCH,
} from '@helper/polla/types/game.type';
import { pollaCashierCode } from '@helper/polla/types/user.type';
import { useTicketCheck } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { BetNumbers } from '@/components/BetNumbers';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

/** `2-5 · Pedro`: el número de pasador se repite entre grupos. */
const cashierLabel = (cashier: {
  name: string;
  number: number | null;
  group_number: number | null;
}) => {
  const code = pollaCashierCode(cashier.group_number, cashier.number);
  return `${code ? `${code} · ` : ''}${cashier.name}`;
};

const holderLabel = (holder: IPollaTicketHolder) =>
  `${holder.type === 'PLAYER' ? 'Jugador' : 'Pasador'} · ${holder.name}${
    holder.identifier ? ` · ${holder.identifier}` : ''
  }`;

const TicketStatus = ({ check }: { check: IPollaTicketCheck }) => {
  if (check.bet.winner) {
    return (
      <Badge variant="success" className="text-sm">
        Ganador · ${fmtMoney(check.bet.prize)}
      </Badge>
    );
  }
  if (check.edition.status === POLLA_EDITION_STATUS.FINISHED) {
    return <Badge variant="outline">No ganó</Badge>;
  }
  return <Badge variant="secondary">Jugando</Badge>;
};

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-medium tabular-nums">{children}</dd>
  </div>
);

/**
 * "Revisar ticket": si un ticket ganó, cuánto se llevó, de quién es (pasador,
 * o jugador y su pasador) y cómo se repartió el pozo de su edición. Busca
 * siempre dentro de la propia organización.
 */
export const CheckTicketPage = () => {
  const [ticket, setTicket] = useState('');
  const ticketNumber = useDebouncedValue(ticket.trim());

  const { data: check, isFetching, isError } = useTicketCheck(ticketNumber);
  const { data: lotteries } = useLotteries();
  const { data: schedules } = useSchedules();

  const lotteryName = useMemo(
    () => lotteries?.data.find((l) => l.polla_lottery_id === check?.edition.polla_lottery_id)?.name,
    [lotteries, check]
  );
  const scheduleName = useMemo(
    () =>
      schedules?.data.find((s) => s.polla_schedule_id === check?.edition.polla_schedule_id)?.name,
    [schedules, check]
  );

  const isValid = POLLA_TICKET_SEARCH.test(ticketNumber);

  let emptyMessage = 'Escribí el número de ticket';
  if (ticketNumber && !isValid) emptyMessage = 'Número de ticket inválido';
  else if (isFetching) emptyMessage = 'Buscando…';
  else if (isError) emptyMessage = 'No hay un ticket con ese número en tu organización';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader description="Si el ticket ganó, el premio, el pozo y lo que se llevó cada ganador." />

      <div className="flex flex-col gap-1 sm:w-[320px]">
        <Label htmlFor="check-ticket-number">Nº de ticket</Label>
        <Input
          id="check-ticket-number"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="Nº de ticket"
          value={ticket}
          onChange={(e) => setTicket(e.target.value.replace(/[^\d-]/g, ''))}
        />
      </div>

      {!check || !isValid || isError ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm text-muted-foreground">{check.bet.ticket_number}</p>
                <p className="text-lg font-semibold">{holderLabel(check.holder)}</p>
                {check.holder.type === 'PLAYER' && (
                  <p className="text-sm text-muted-foreground">
                    Jugador del pasador {cashierLabel(check.cashier)}
                  </p>
                )}
                {check.holder.type === 'CASHIER' && check.cashier.number && (
                  <p className="text-sm text-muted-foreground">
                    Pasador Nº {pollaCashierCode(check.cashier.group_number, check.cashier.number)}
                  </p>
                )}
              </div>
              <TicketStatus check={check} />
            </div>

            <BetNumbers numbers={check.bet.numbers} hitDates={check.bet.hit_dates} />

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Detail label="Aciertos">{check.bet.hits}</Detail>
              <Detail label="Cargado">{fmtDate(check.bet.load_date)}</Detail>
              <Detail label="Premio">
                {check.bet.winner ? `$${fmtMoney(check.bet.prize)}` : '-'}
              </Detail>
              <Detail label="Completó">{fmtDate(check.bet.hit_date)}</Detail>
            </dl>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground sm:p-6">
            <h2 className="text-lg font-medium">
              {lotteryName ?? 'Quiniela'} · {scheduleName ?? 'Turno'}
              {check.edition.name ? ` · ${check.edition.name}` : ''}
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Detail label="Pozo">
                ${fmtMoney(check.edition.pool_amount)}
                {Number(check.edition.surprise_pool_amount ?? 0) > 0 && (
                  <span className="block text-xs font-semibold text-success">
                    + sorpresa ${fmtMoney(check.edition.surprise_pool_amount)}
                  </span>
                )}
              </Detail>
              <Detail label="Valor del ticket">${fmtMoney(check.edition.ticket_price)}</Detail>
              <Detail label="Juega">
                {fmtDate(check.edition.start_date)} al {fmtDate(check.edition.end_date)}
              </Detail>
              <Detail label="Ganadores">
                {check.winners.length === 0
                  ? 'Todavía no hay'
                  : check.edition.winner_date
                    ? `${check.winners.length} · el ${fmtDate(check.edition.winner_date)}`
                    : check.winners.length}
              </Detail>
            </dl>

            {check.winners.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>Pasador</TableHead>
                      <TableHead className="text-right">Premio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {check.winners.map((winner) => (
                      <TableRow
                        key={winner.ticket_number}
                        className={cn(
                          winner.ticket_number === check.bet.ticket_number &&
                            'bg-hit/30 font-semibold'
                        )}
                      >
                        <TableCell className="font-mono text-xs">{winner.ticket_number}</TableCell>
                        <TableCell>{holderLabel(winner.holder)}</TableCell>
                        <TableCell>
                          {cashierLabel({
                            name: winner.cashier_name,
                            number: winner.cashier_number,
                            group_number: winner.group_number,
                          })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${fmtMoney(winner.prize)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default CheckTicketPage;
