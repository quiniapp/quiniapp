import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Pencil, Printer, Trash2 } from 'lucide-react';
import {
  IPollaBetListItem,
  IPollaEditionEntityFront,
  POLLA_EDITION_STATUS,
  POLLA_NUMBERS_REQUIRED,
  isPublicPollaBet,
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
import { betNumberClass, hitTitle } from '@/lib/betNumbers';
import { cn } from '@/lib/utils';
import { EditBetDialog, EditableBet } from './EditBetDialog';

const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

const SLOTS = Array.from({ length: POLLA_NUMBERS_REQUIRED }, (_, i) => i);

const editionLabel = (
  edition: IPollaEditionEntityFront,
  lotteryName?: string,
  scheduleName?: string
) =>
  `${lotteryName ?? 'Quiniela'} · ${scheduleName ?? 'Turno'} (${fmtDate(edition.start_date)} al ${fmtDate(
    edition.end_date
  )})`;

const cashierLabel = (row: IPollaBetListItem) =>
  `${row.cashier_number ? `${row.cashier_number} · ` : ''}${row.cashier_name}`;

interface BetsPageProps {
  /** Vista "Mis jugadas": fuerza el filtro a las del usuario. */
  onlyMine?: boolean;
}

export const BetsPage = ({ onlyMine = false }: BetsPageProps) => {
  const { user, role, organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManage = Boolean(role && isPollaAdminRole(role));
  // Pasador y jugador pueden acotar a lo suyo; el admin filtra por pasador.
  const canFilterMine = !onlyMine && !canManage;

  const [ticketSearch, setTicketSearch] = useState(searchParams.get('ticket_number') ?? '');
  const [editing, setEditing] = useState<EditableBet | null>(null);

  const debouncedTicket = useDebouncedValue(ticketSearch.trim());
  const editionId = searchParams.get('polla_edition_id') ?? '';
  const cashierId = searchParams.get('cashier_polla_user_id') ?? '';
  const sort = searchParams.get('sort') === 'recent' ? 'recent' : 'hits';
  const mine = onlyMine || (canFilterMine && searchParams.get('mine') === '1');

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

  const editionList = useMemo(() => editions?.data ?? [], [editions]);
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
      mine: mine ? 'true' : undefined,
      sort,
    },
    Boolean(editionId) || searching
  );

  const { data: winners } = useWinners(editionId || null);
  const { mutate: deleteBet } = useDeleteBet();

  const handlePrint = async (row: IPollaBetListItem) => {
    const edition = editionList.find((e) => e.polla_edition_id === row.polla_edition_id);
    if (!edition) return;

    const { blob, fileName } = await makePollaTicketPdf({
      ticket_number: row.ticket_number,
      user_name: isPublicPollaBet(row) ? (row.client_name ?? row.cashier_name) : row.user_name,
      cashier_number: row.cashier_number ?? undefined,
      numbers: row.numbers,
      lotteryName: lotteryById.get(edition.polla_lottery_id) ?? '',
      scheduleName: scheduleById.get(edition.polla_schedule_id) ?? '',
      startDate: edition.start_date,
      endDate: edition.end_date,
      loadDate: row.load_date,
      ticketPrice: Number(edition.ticket_price),
      poolAmount: Number(edition.pool_amount),
    });

    await deliverPdf(blob, fileName, `Ticket Polla ${row.ticket_number}`);
  };

  const { rows, totalCount } = flattenPages(bets?.pages);

  // Estado y acciones se comparten entre la tabla (desktop) y las tarjetas (mobile).
  const renderStatus = (row: IPollaBetListItem) => {
    if (row.winner) {
      return <Badge variant="success">Ganadora {fmtDate(row.hit_date)}</Badge>;
    }
    if (isPublicPollaBet(row) && row.is_mine) {
      return <Badge variant="outline">Mía</Badge>;
    }
    return <span className="text-xs text-muted-foreground">{fmtDate(row.load_date)}</span>;
  };

  const renderActions = (row: IPollaBetListItem) => {
    const isPublic = isPublicPollaBet(row);
    const canPrint = canManage || (isPublic && row.is_mine);
    const canEdit =
      !row.winner &&
      (canManage || (isPublic ? row.can_edit : row.polla_user_id === user?.polla_user_id));

    if (!canPrint && !canEdit) return null;

    return (
      <>
        {canPrint && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Imprimir"
            onClick={() => handlePrint(row)}
          >
            <Printer />
          </Button>
        )}
        {canEdit && (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Editar"
              onClick={() => setEditing(row)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Eliminar"
              onClick={() => {
                if (window.confirm(`¿Eliminar la jugada ${row.ticket_number}?`)) {
                  deleteBet({ id: row.polla_bet_id });
                }
              }}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </>
    );
  };

  return (
    <div>
      {winners && winners.data.length > 0 && (
        <div className="mb-4 rounded-md border-2 border-success bg-card p-3 text-sm text-card-foreground">
          <strong>Ganadores de la edición:</strong>{' '}
          {winners.data
            .map(
              (w) => `${w.client_name ?? w.cashier_name} (${w.ticket_number}) $${fmtMoney(w.prize)}`
            )
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
              que el select no dice. La cantidad de jugadas es un total: solo
              la recibe un admin. */}
          {selectedEdition && (
            <p className="text-xs text-muted-foreground">
              Pozo ${fmtMoney(selectedEdition.pool_amount)}
              {selectedEdition.bets_count !== undefined &&
                ` · ${selectedEdition.bets_count} jugadas`}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Label>Buscar ticket</Label>
          <Input
            value={ticketSearch}
            placeholder="Nº de ticket"
            inputMode="numeric"
            onChange={(e) => {
              setTicketSearch(e.target.value);
            }}
            className="w-full sm:w-[220px]"
          />
        </div>

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

        {canFilterMine && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Mostrar</Label>
            <Select
              value={mine ? 'mine' : 'all'}
              onValueChange={(value) => updateParam('mine', value === 'mine' ? '1' : '')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las jugadas</SelectItem>
                <SelectItem value="mine">
                  {role === POLLA_USER_TYPE.CASHIER ? 'Mías y de mis jugadores' : 'Solo mías'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <Label>Ordenar por</Label>
          <Select
            value={sort}
            onValueChange={(value) => updateParam('sort', value === 'recent' ? 'recent' : '')}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hits">Más aciertos</SelectItem>
              <SelectItem value="recent">Más recientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
          {/* Mobile: tarjetas. Una tabla de 16 columnas en 320px obliga a
              scrollear de costado para leer una sola jugada. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((row: IPollaBetListItem) => (
              <li
                key={row.polla_bet_id}
                className="rounded-md border bg-card p-3 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {row.ticket_number}
                    </p>
                    <p className="truncate text-sm">
                      {row.group_name && (
                        <span className="text-muted-foreground">{row.group_name} · </span>
                      )}
                      {cashierLabel(row)}
                      {row.client_name && (
                        <span className="font-semibold"> · {row.client_name}</span>
                      )}
                    </p>
                  </div>
                  <Badge variant="success" className="shrink-0 text-sm tabular-nums">
                    {row.hits}
                  </Badge>
                </div>

                <div className="mt-2">
                  <BetNumbers numbers={row.numbers} hitDates={row.hit_dates} />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  {renderStatus(row)}
                  <div className="flex gap-1">{renderActions(row)}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: planilla con un casillero por número; los acertados en
              amarillo. */}
          <div className="hidden rounded-md border bg-card text-card-foreground md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Coord</TableHead>
                  <TableHead>Pasador</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Aciertos</TableHead>
                  {SLOTS.map((slot) => (
                    <TableHead key={slot} className="w-10 text-center">
                      {slot + 1}
                    </TableHead>
                  ))}
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: IPollaBetListItem) => (
                  <TableRow key={row.polla_bet_id}>
                    <TableCell className="font-mono text-xs">{row.ticket_number}</TableCell>
                    <TableCell>{row.group_name ?? ''}</TableCell>
                    <TableCell>{cashierLabel(row)}</TableCell>
                    <TableCell className="font-medium">{row.client_name ?? ''}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" className="tabular-nums">
                        {row.hits}
                      </Badge>
                    </TableCell>
                    {SLOTS.map((slot) => {
                      const hitDate = row.hit_dates?.[slot] ?? null;
                      return (
                        <TableCell
                          key={slot}
                          title={hitTitle(hitDate)}
                          className={cn(
                            'border-l text-center font-mono text-sm tabular-nums',
                            hitDate && betNumberClass(true)
                          )}
                        >
                          {row.numbers[slot]}
                        </TableCell>
                      );
                    })}
                    <TableCell>{renderStatus(row)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">{renderActions(row)}</div>
                    </TableCell>
                  </TableRow>
                ))}
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
