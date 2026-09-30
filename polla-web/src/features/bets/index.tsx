import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Pencil, Printer, Trash2 } from 'lucide-react';
import {
  IPollaBetEntityFront,
  IPollaBetListItem,
  IPollaEditionEntityFront,
  POLLA_EDITION_STATUS,
  isAnonymousPollaBet,
} from '@helper/polla/types/game.type';
import { POLLA_USER_TYPE, isPollaAdminRole } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useBets, useEditions, useUserOptions, useWinners } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useDeleteBet } from '@/hooks/mutations/usePollaMutations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { flattenPages } from '@/hooks/useApi';
import { BetNumbers } from '@/components/BetNumbers';
import { EmptyState } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { makePollaTicketPdf } from '@/functions/makePollaTicket';
import { deliverPdf } from '@/functions/printPdf';
import { EditBetDialog } from './EditBetDialog';

const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

export const editionLabel = (
  edition: IPollaEditionEntityFront,
  lotteryName?: string,
  scheduleName?: string
) =>
  `${lotteryName ?? 'Quiniela'} · ${scheduleName ?? 'Turno'} (${fmtDate(edition.start_date)} al ${fmtDate(
    edition.end_date
  )})`;

interface BetsPageProps {
  /** Vista "Mis jugadas": fuerza el filtro a las del usuario. */
  onlyMine?: boolean;
}

export const BetsPage = ({ onlyMine = false }: BetsPageProps) => {
  const { user, role, organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isPlayer = role === POLLA_USER_TYPE.PLAYER;
  const isStaff = Boolean(role) && !isPlayer;
  const canManage = Boolean(role && isPollaAdminRole(role));

  const [ticketSearch, setTicketSearch] = useState(searchParams.get('ticket_number') ?? '');
  const [editing, setEditing] = useState<IPollaBetEntityFront | null>(null);

  const debouncedTicket = useDebouncedValue(ticketSearch);
  const editionId = searchParams.get('polla_edition_id') ?? '';
  const cashierId = searchParams.get('cashier_polla_user_id') ?? '';

  const { data: editions } = useEditions({ polla_organization_id: organizationId ?? undefined });
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });
  const { data: cashiers } = useUserOptions(
    { user_type: POLLA_USER_TYPE.CASHIER, limit: 200 },
    canManage
  );

  const lotteryById = useMemo(
    () => new Map(lotteries?.data.map((l) => [l.polla_lottery_id, l.name])),
    [lotteries]
  );
  const scheduleById = useMemo(
    () => new Map(schedules?.data.map((s) => [s.polla_schedule_id, s.name])),
    [schedules]
  );

  const editionList = editions?.data ?? [];
  const selectedEdition = editionList.find((e) => e.polla_edition_id === editionId);

  // Sin edición elegida se abre en la más reciente que siga activa.
  useEffect(() => {
    if (editionId || editionList.length === 0) return;
    const preferred =
      editionList.find((e) => e.status === POLLA_EDITION_STATUS.ACTIVE) ?? editionList[0];
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('polla_edition_id', preferred.polla_edition_id);
        return next;
      },
      { replace: true }
    );
  }, [editionId, editionList, setSearchParams]);

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const searching = debouncedTicket.length > 0;

  const {
    data: bets,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBets(
    {
      polla_edition_id: searching ? undefined : editionId || undefined,
      ticket_number: searching ? debouncedTicket : undefined,
      cashier_polla_user_id: canManage && !searching ? cashierId || undefined : undefined,
      mine: onlyMine ? 'true' : undefined,
    },
    Boolean(editionId) || searching
  );

  const { data: winners } = useWinners(editionId || null);
  const { mutate: deleteBet } = useDeleteBet();

  const handlePrint = async (bet: IPollaBetEntityFront) => {
    if (!selectedEdition) return;

    const { blob, fileName } = await makePollaTicketPdf({
      ticket_number: bet.ticket_number,
      user_name: bet.user_name,
      cashier_number: bet.cashier_number ?? undefined,
      numbers: bet.numbers,
      lotteryName: lotteryById.get(selectedEdition.polla_lottery_id) ?? '',
      scheduleName: scheduleById.get(selectedEdition.polla_schedule_id) ?? '',
      startDate: selectedEdition.start_date,
      endDate: selectedEdition.end_date,
      loadDate: bet.load_date,
      ticketPrice: Number(bet.amount),
      poolAmount: Number(selectedEdition.pool_amount),
    });

    await deliverPdf(blob, fileName, `Ticket Polla ${bet.ticket_number}`);
  };

  const { rows, totalCount } = flattenPages(bets?.pages);

  // Estado y acciones se comparten entre la tabla (desktop) y las tarjetas (mobile).
  const renderStatus = (row: IPollaBetListItem, full: IPollaBetEntityFront | null) => {
    if (row.winner) {
      return <Badge className="bg-emerald-600">Ganadora {fmtDate(row.hit_date)}</Badge>;
    }
    if (isAnonymousPollaBet(row) && row.is_mine) {
      return <Badge variant="outline">Mía</Badge>;
    }
    return (
      <span className="text-xs text-muted-foreground">
        {full ? fmtDate(full.load_date) : 'En juego'}
      </span>
    );
  };

  const renderActions = (full: IPollaBetEntityFront) => (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title="Imprimir"
        onClick={() => handlePrint(full)}
      >
        <Printer />
      </Button>
      {(canManage || full.polla_user_id === user?.polla_user_id) && !full.winner && (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Editar"
            onClick={() => setEditing(full)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Eliminar"
            onClick={() => {
              if (window.confirm(`¿Eliminar la jugada ${full.ticket_number}?`)) {
                deleteBet({ id: full.polla_bet_id });
              }
            }}
          >
            <Trash2 />
          </Button>
        </>
      )}
    </>
  );

  return (
    <div>
      {winners && winners.data.length > 0 && (
        <div className="mb-4 rounded-md border border-emerald-600/40 bg-emerald-600/10 p-3 text-sm">
          <strong>Ganadores de la edición:</strong>{' '}
          {winners.data
            .map((w) => `${w.user_name} (${w.ticket_number}) $${fmtMoney(w.prize)}`)
            .join(' · ')}
        </div>
      )}

      {/* Los filtros ocupan el ancho completo en mobile y se acomodan en línea
          desde sm: en 320px cualquier ancho fijo desborda. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-col gap-1 sm:min-w-[260px]">
          <Label>Edición</Label>
          <Select
            value={editionId}
            onValueChange={(value) => updateParam('polla_edition_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Elegí una edición" />
            </SelectTrigger>
            <SelectContent>
              {editionList.map((edition) => (
                <SelectItem key={edition.polla_edition_id} value={edition.polla_edition_id}>
                  {editionLabel(
                    edition,
                    lotteryById.get(edition.polla_lottery_id),
                    scheduleById.get(edition.polla_schedule_id)
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Quiniela, turno y fechas ya están en el select: acá va solo lo
              que el select no dice. */}
          {selectedEdition && (
            <p className="text-xs text-muted-foreground">
              Pozo ${fmtMoney(selectedEdition.pool_amount)} · {selectedEdition.bets_count} jugadas
            </p>
          )}
        </div>

        {isStaff && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Buscar ticket</Label>
            <Input
              value={ticketSearch}
              placeholder="Nº de ticket"
              onChange={(e) => {
                setTicketSearch(e.target.value);
              }}
              className="w-full sm:w-[220px]"
            />
          </div>
        )}

        {canManage && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Pasador</Label>
            <Select
              value={cashierId || 'all'}
              onValueChange={(value) =>
                updateParam('cashier_polla_user_id', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {cashiers?.data.map((cashier) => (
                  <SelectItem key={cashier.polla_user_id} value={cashier.polla_user_id}>
                    {cashier.number ? `${cashier.number} · ` : ''}
                    {cashier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState message={isFetching ? 'Cargando…' : 'No hay jugadas para mostrar'} />
      ) : (
        <InfiniteList
          totalCount={totalCount}
          loadedCount={rows.length}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        >
          {/* Mobile: tarjetas. Una tabla de 7 columnas en 320px obliga a
              scrollear de costado para leer una sola jugada. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map((row: IPollaBetListItem) => {
              const anonymous = isAnonymousPollaBet(row);
              const full = anonymous ? null : (row as IPollaBetEntityFront);

              return (
                <li key={row.polla_bet_id} className="rounded-md border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {row.ticket_number}
                      </p>
                      {full && (
                        <p className="truncate text-sm">
                          {full.user_name}
                          {full.cashier_name !== full.user_name && (
                            <span className="text-muted-foreground"> · {full.cashier_name}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {row.hits}/10
                    </span>
                  </div>

                  <div className="mt-2">
                    <BetNumbers numbers={row.numbers} hitNumbers={row.hit_numbers} />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    {renderStatus(row, full)}
                    {isStaff && full && <div className="flex gap-1">{renderActions(full)}</div>}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden rounded-md border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  {isStaff && <TableHead>Jugador</TableHead>}
                  {isStaff && <TableHead>Pasador</TableHead>}
                  <TableHead>Números</TableHead>
                  <TableHead>Aciertos</TableHead>
                  <TableHead>Estado</TableHead>
                  {isStaff && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: IPollaBetListItem) => {
                  const anonymous = isAnonymousPollaBet(row);
                  const full = anonymous ? null : (row as IPollaBetEntityFront);

                  return (
                    <TableRow key={row.polla_bet_id}>
                      <TableCell className="font-mono text-xs">{row.ticket_number}</TableCell>

                      {isStaff && <TableCell>{full?.user_name}</TableCell>}
                      {isStaff && (
                        <TableCell>
                          {full?.cashier_number ? `${full.cashier_number} · ` : ''}
                          {full?.cashier_name}
                        </TableCell>
                      )}

                      <TableCell>
                        <BetNumbers numbers={row.numbers} hitNumbers={row.hit_numbers} />
                      </TableCell>

                      <TableCell className="tabular-nums">{row.hits}/10</TableCell>

                      <TableCell>{renderStatus(row, full)}</TableCell>

                      {isStaff && full && (
                        <TableCell>
                          <div className="flex justify-end gap-1">{renderActions(full)}</div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </InfiniteList>
      )}

      <EditBetDialog bet={editing} onClose={() => setEditing(null)} />
    </div>
  );
};

export default BetsPage;
