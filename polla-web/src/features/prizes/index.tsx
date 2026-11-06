import { useState } from 'react';
import dayjs from 'dayjs';
import { IPollaPrize, PollaPrizePaidFilter } from '@helper/polla/types/game.type';
import { POLLA_USER_TYPE, isPollaSuperRole, pollaCashierCode } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { usePrizes } from '@/hooks/fetchs/usePollaData';
import { useMarkPrizePaid } from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EditionPicker } from '@/features/bets/EditionPicker';
import { useBetsEdition } from '@/features/bets/useBetsEdition';
import { fmtDate, fmtMoney } from '@/features/bets/format';
import { groupLabel } from '@/lib/pollaGroups';
import { cn } from '@/lib/utils';

/** `2-5 · Pedro`: el número de pasador se repite entre grupos. */
const cashierOf = (prize: IPollaPrize) => {
  const code = pollaCashierCode(prize.group_number, prize.cashier_number);
  return `${code ? `${code} · ` : ''}${prize.cashier_name}`;
};

/** Jugador y/o identificador del ticket ("Ana · chicho"). */
const clientOf = (prize: IPollaPrize) =>
  [prize.client_name, prize.identifier].filter(Boolean).join(' · ') || '-';

const groupOf = (prize: IPollaPrize) =>
  groupLabel(prize.group_name ? { name: prize.group_name, number: prize.group_number ?? 0 } : null);

/** "Pagado 05/11 10:20 · Owner". */
const paidLabel = (prize: IPollaPrize) =>
  `Pagado ${dayjs(prize.prize_paid_at).format('DD/MM HH:mm')}${
    prize.prize_paid_by_name ? ` · ${prize.prize_paid_by_name}` : ''
  }`;

type PaidView = '' | PollaPrizePaidFilter;

const PAID_VIEWS: [PaidView, string][] = [
  ['', 'Todos'],
  ['false', 'No pagados'],
  ['true', 'Pagados'],
];

/**
 * Premios (R19 y R20): por edición, cada ticket ganador con grupo, pasador,
 * jugador o cliente, número de ticket y monto, y si ya se pagó. Salen de la
 * generación de ganadores; ya no pasan por la cuenta corriente (R18). El
 * dueño, el capitalista y el superadmin tildan los que transfirieron: queda
 * quién y cuándo, y no se destilda.
 */
export const PrizesPage = () => {
  const { role, organizationId } = useAuth();
  const { editionId, editionList, labelFor, updateEdition } = useBetsEdition();
  const [paidView, setPaidView] = useState<PaidView>('');
  const canMarkPaid = Boolean(role && isPollaSuperRole(role));
  // R21: el jugador ve sus premios, no si se pagaron (eso es entre el
  // capitalista y el pasador). La API tampoco se lo manda.
  const seesPaid = role !== POLLA_USER_TYPE.PLAYER;

  const description =
    role === POLLA_USER_TYPE.PLAYER
      ? 'Tus tickets que ganaron en cada edición y cuánto se lleva cada uno.'
      : role === POLLA_USER_TYPE.CASHIER
        ? 'Tus tickets y los de tus jugadores que ganaron en cada edición, cuánto se lleva cada uno y si ya se pagó.'
        : role === POLLA_USER_TYPE.ADMIN
          ? 'Los tickets ganadores de tu grupo en cada edición, cuánto se lleva cada uno y si ya se pagó.'
          : 'Los tickets ganadores de cada edición, cuánto se lleva cada uno y si ya se pagó. Los premios no van en la cuenta corriente.';

  const { data, isFetching } = usePrizes(
    {
      polla_edition_id: editionId,
      paid: (seesPaid && paidView) || undefined,
      polla_organization_id: organizationId,
    },
    Boolean(editionId)
  );
  const { mutate: markPaid, isPending: isMarking } = useMarkPrizePaid();
  const prizes = data?.prizes ?? [];

  const handleMarkPaid = (prize: IPollaPrize) => {
    if (
      !window.confirm(
        `¿Marcar como pagado el premio de $${fmtMoney(prize.prize)} del ticket ${prize.ticket_number}? No se puede destildar.`
      )
    ) {
      return;
    }
    markPaid({ betId: prize.polla_bet_id });
  };

  /** La casilla para quien paga; para el resto, el estado. */
  const renderPaid = (prize: IPollaPrize) => {
    if (prize.prize_paid_at) {
      return (
        <span className="flex items-center gap-2">
          <Checkbox
            checked
            disabled
            aria-label={`Premio del ticket ${prize.ticket_number} pagado`}
          />
          <span className="text-xs text-muted-foreground">{paidLabel(prize)}</span>
        </span>
      );
    }
    if (!canMarkPaid) return <Badge variant="outline">No pagado</Badge>;
    return (
      <span className="flex items-center gap-2">
        <Checkbox
          id={`prize-paid-${prize.polla_bet_id}`}
          checked={false}
          disabled={isMarking}
          onCheckedChange={(checked) => checked === true && handleMarkPaid(prize)}
          aria-label={`Marcar como pagado el premio del ticket ${prize.ticket_number}`}
        />
        <Label htmlFor={`prize-paid-${prize.polla_bet_id}`} className="cursor-pointer text-xs">
          No pagado
        </Label>
      </span>
    );
  };

  return (
    <div>
      <PageHeader description={description} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <EditionPicker
          editions={editionList}
          value={editionId}
          onChange={updateEdition}
          labelFor={labelFor}
        />

        {seesPaid && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label id="prizes-paid-label">Ver</Label>
            <div
              role="radiogroup"
              aria-labelledby="prizes-paid-label"
              className="inline-flex rounded-md border bg-card p-1"
            >
              {PAID_VIEWS.map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={paidView === value}
                  onClick={() => setPaidView(value)}
                  className={cn(
                    'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                    paidView === value
                      ? 'bg-nav-active text-nav-active-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          'mb-4 grid grid-cols-2 gap-3',
          seesPaid ? 'lg:max-w-3xl lg:grid-cols-4' : 'lg:max-w-xl'
        )}
      >
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Ganadores</p>
          <p className="text-3xl font-bold tabular-nums">{data?.count ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">En premios</p>
          <p className="text-2xl font-bold tabular-nums">${fmtMoney(data?.amount ?? 0)}</p>
        </div>
        {seesPaid && (
          <>
            <div className="rounded-xl border bg-card p-4 text-card-foreground">
              <p className="text-sm text-muted-foreground">Pagado</p>
              <p className="text-2xl font-bold tabular-nums">${fmtMoney(data?.paid_amount ?? 0)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-card-foreground">
              <p className="text-sm text-muted-foreground">Falta pagar</p>
              <p className="text-2xl font-bold tabular-nums">
                ${fmtMoney(data?.pending_amount ?? 0)}
              </p>
            </div>
          </>
        )}
      </div>

      {prizes.length === 0 ? (
        <EmptyState
          message={
            isFetching
              ? 'Cargando…'
              : paidView && (data?.count ?? 0) > 0
                ? paidView === 'true'
                  ? 'Todavía no se pagó ningún premio de esta edición'
                  : 'Todos los premios de esta edición están pagados'
                : 'Esta edición todavía no tiene ganadores'
          }
        />
      ) : (
        <>
          {/* Mobile: tarjetas. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {prizes.map((prize) => (
              <li
                key={prize.polla_bet_id}
                className="rounded-md border bg-card p-3 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {prize.ticket_number}
                    </p>
                    <p className="truncate text-sm">
                      <span className="text-muted-foreground">{groupOf(prize)} · </span>
                      {cashierOf(prize)}
                    </p>
                    <p className="truncate text-sm font-semibold">{clientOf(prize)}</p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">
                      ${fmtMoney(prize.prize)}
                    </span>
                    <Badge variant="success" className="tabular-nums">
                      {prize.hits} aciertos
                    </Badge>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Ganó el {fmtDate(prize.hit_date)}
                  </span>
                  {seesPaid && renderPaid(prize)}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden rounded-md border bg-card text-card-foreground md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Pasador</TableHead>
                  <TableHead>Jugador o cliente</TableHead>
                  <TableHead className="text-center">Aciertos</TableHead>
                  <TableHead>Ganó el</TableHead>
                  <TableHead className="text-right">Premio</TableHead>
                  {seesPaid && <TableHead>Pagado</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {prizes.map((prize) => (
                  <TableRow key={prize.polla_bet_id}>
                    <TableCell className="font-mono text-xs">{prize.ticket_number}</TableCell>
                    <TableCell>{groupOf(prize)}</TableCell>
                    <TableCell>{cashierOf(prize)}</TableCell>
                    <TableCell className="font-medium">{clientOf(prize)}</TableCell>
                    <TableCell className="text-center tabular-nums">{prize.hits}</TableCell>
                    <TableCell className="tabular-nums">{fmtDate(prize.hit_date)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${fmtMoney(prize.prize)}
                    </TableCell>
                    {seesPaid && <TableCell>{renderPaid(prize)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
              {!paidView && (
                <TableFooter>
                  <TableRow className="font-semibold">
                    <TableCell colSpan={6}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(data?.amount ?? 0)}
                    </TableCell>
                    {seesPaid && <TableCell />}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default PrizesPage;
