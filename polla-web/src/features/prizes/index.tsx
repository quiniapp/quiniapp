import { IPollaPrize } from '@helper/polla/types/game.type';
import { pollaCashierCode } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { usePrizes } from '@/hooks/fetchs/usePollaData';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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

/**
 * Premios (R19): por edición, cada ticket ganador con grupo, pasador, jugador
 * o cliente, número de ticket y monto. Salen de la generación de ganadores; ya
 * no pasan por la cuenta corriente (R18).
 */
export const PrizesPage = () => {
  const { organizationId } = useAuth();
  const { editionId, editionList, labelFor, updateEdition } = useBetsEdition();

  const { data, isFetching } = usePrizes(
    { polla_edition_id: editionId, polla_organization_id: organizationId },
    Boolean(editionId)
  );
  const prizes = data?.prizes ?? [];

  return (
    <div>
      <PageHeader description="Los tickets ganadores de cada edición y cuánto se lleva cada uno. Los premios no van en la cuenta corriente." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <EditionPicker
          editions={editionList}
          value={editionId}
          onChange={updateEdition}
          labelFor={labelFor}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:max-w-xl">
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Ganadores</p>
          <p className="text-3xl font-bold tabular-nums">{data?.count ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">En premios</p>
          <p className="text-3xl font-bold tabular-nums">${fmtMoney(data?.amount ?? 0)}</p>
        </div>
      </div>

      {prizes.length === 0 ? (
        <EmptyState
          message={isFetching ? 'Cargando…' : 'Esta edición todavía no tiene ganadores'}
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Ganó el {fmtDate(prize.hit_date)}
                </p>
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
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={6}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(data?.amount ?? 0)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default PrizesPage;
