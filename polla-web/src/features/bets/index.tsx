import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Gift, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react';
import {
  IPollaBetListItem,
  IPollaEditionEntityFront,
  POLLA_EDITION_STATUS,
  POLLA_HITS_FILTER,
  POLLA_NUMBERS_REQUIRED,
  isPublicPollaBet,
} from '@helper/polla/types/game.type';
import {
  IPollaUserOption,
  POLLA_USER_TYPE,
  POLLA_USER_TYPE_LABEL,
  isPollaAdminRole,
  isPollaSuperRole,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import {
  useBets,
  useEditions,
  useRefreshBets,
  useUser,
  useWinners,
} from '@/hooks/fetchs/usePollaData';
import { useGroups, useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useDeleteBet } from '@/hooks/mutations/usePollaMutations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PollaPage, flattenPages } from '@/hooks/useApi';
import { BetNumbers } from '@/components/BetNumbers';
import { EmptyState } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { UserSearchPicker } from '@/components/UserSearchPicker';
import { pollaUserOption } from '@/lib/pollaUsers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { FreeRepeatDialog } from './FreeRepeatDialog';
import { ResultFilters, WinnerFilter } from './ResultFilters';
import { ShareTicketsPdfButton } from './ShareTicketsPdfButton';

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

/** `hits=10,9` de la URL → aciertos válidos, en el orden de los checkboxes. */
const parseHits = (raw: string | null): number[] =>
  raw ? POLLA_HITS_FILTER.filter((hit) => raw.split(',').map(Number).includes(hit)) : [];

/** Página del feed de jugadas: con cuántas veces se repitió sin cargo cada ticket. */
type BetsFeedPage = PollaPage<IPollaBetListItem> & { free_repeats?: Record<string, number> };

export const BetsPage = () => {
  const { user, role, organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManage = Boolean(role && isPollaAdminRole(role));
  const isSuper = Boolean(role && isPollaSuperRole(role));
  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  // El jugador solo mira: no imprime, edita ni borra.
  const hasActions = role !== POLLA_USER_TYPE.PLAYER;
  // Pasador y jugador eligen entre lo suyo ("Mis jugadas", por defecto) y todo
  // lo que se está jugando en el capitalista.
  const canFilterMine = !canManage;
  // Todos ven todas las jugadas y las acotan a un grupo: superadmin+ elige
  // cualquiera; el resto, "Solo mi grupo" (si tiene).
  const ownGroupId = user?.polla_group_id ?? null;

  const [ticketSearch, setTicketSearch] = useState(searchParams.get('ticket_number') ?? '');
  const [editing, setEditing] = useState<EditableBet | null>(null);

  const debouncedTicket = useDebouncedValue(ticketSearch.trim());
  const editionId = searchParams.get('polla_edition_id') ?? '';
  const cashierId = searchParams.get('cashier_polla_user_id') ?? '';
  const playerId = searchParams.get('polla_user_id') ?? '';
  const sort = searchParams.get('sort') === 'recent' ? 'recent' : 'hits';
  const mine = canFilterMine && searchParams.get('mine') !== '0';
  const groupId = searchParams.get('polla_group_id') ?? '';
  const winnerParam = searchParams.get('winner');
  const winner: WinnerFilter = winnerParam === 'true' || winnerParam === 'false' ? winnerParam : '';
  const hits = parseHits(searchParams.get('hits'));

  const { data: editions } = useEditions({ polla_organization_id: organizationId ?? undefined });
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });
  const { data: groups } = useGroups(
    { polla_organization_id: organizationId ?? undefined },
    isSuper
  );

  // Todos filtran por pasador (sus jugadas y las de sus jugadores) o por
  // jugador (solo las suyas). El tipo sale del filtro de la URL; sin filtro,
  // del último elegido en "Pasador | Jugador".
  const [pickedType, setPickedType] = useState(() =>
    searchParams.get('polla_user_id') ? POLLA_USER_TYPE.PLAYER : POLLA_USER_TYPE.CASHIER
  );
  const filterType = playerId
    ? POLLA_USER_TYPE.PLAYER
    : cashierId
      ? POLLA_USER_TYPE.CASHIER
      : pickedType;
  const filterUserId = filterType === POLLA_USER_TYPE.PLAYER ? playerId : cashierId;
  const filterParam =
    filterType === POLLA_USER_TYPE.PLAYER ? 'polla_user_id' : 'cashier_polla_user_id';

  // El elegido en el buscador ya trae su nombre; si el filtro vino en la URL
  // (recarga, link), se trae por id (y, si es un jugador, también su pasador).
  const [pickedUser, setPickedUser] = useState<IPollaUserOption | null>(null);
  const pickedMatches = Boolean(filterUserId) && pickedUser?.polla_user_id === filterUserId;
  // Por id solo se trae a quien se administra (un pasador o jugador ajeno es 403).
  const { data: userFromUrl } = useUser(
    canManage && filterUserId && !pickedMatches ? filterUserId : null
  );
  const urlUser = userFromUrl?.polla_user_id === filterUserId ? userFromUrl : null;
  const urlCashierId =
    urlUser?.user_type === POLLA_USER_TYPE.PLAYER ? urlUser.parent_polla_user_id : null;
  const { data: cashierOfUrlUser } = useUser(urlCashierId);
  const selectedUser = useMemo(() => {
    if (!filterUserId) return null;
    if (pickedMatches) return pickedUser;
    if (!canManage || !urlUser) return null;
    const cashier = cashierOfUrlUser?.polla_user_id === urlCashierId ? cashierOfUrlUser : null;
    return pollaUserOption(urlUser, cashier);
  }, [canManage, filterUserId, pickedMatches, pickedUser, urlUser, urlCashierId, cashierOfUrlUser]);
  // Filtros de grupo, usuario y resultado para la lista y el PDF.
  const userFilter: Record<string, string> = {
    ...(filterUserId && !mine ? { [filterParam]: filterUserId } : {}),
    ...(groupId && !mine ? { polla_group_id: groupId } : {}),
  };
  const resultFilter = {
    winner: winner || undefined,
    hits: hits.length ? hits.join(',') : undefined,
  };

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

  /** "Pasador | Jugador": cambiar de tipo suelta al elegido y su filtro. */
  const changeFilterType = (type: POLLA_USER_TYPE) => {
    setPickedType(type);
    setPickedUser(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('cashier_polla_user_id');
      next.delete('polla_user_id');
      return next;
    });
  };

  const searching = debouncedTicket.length > 0;

  // Repetir sin cargo: superadmin+ y el admin, con la edición ya finalizada.
  const canFreeRepeat =
    canManage && !searching && selectedEdition?.status === POLLA_EDITION_STATUS.FINISHED;

  const betsParams = {
    polla_edition_id: searching ? undefined : editionId || undefined,
    ticket_number: searching ? debouncedTicket : undefined,
    ...(searching ? {} : userFilter),
    ...(searching ? {} : resultFilter),
    mine: mine ? 'true' : undefined,
    with_free_repeats: canFreeRepeat ? 'true' : undefined,
    sort,
  };
  const betsEnabled = Boolean(editionId) || searching;

  const {
    data: bets,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBets(betsParams, betsEnabled);

  // "Actualizar": trae lo último cargado (la primera página de nuevo).
  const refreshBets = useRefreshBets();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBets(betsParams);
    } finally {
      setRefreshing(false);
    }
  };

  const { data: winners } = useWinners(editionId || null);

  // Tickets elegidos para repetir sin cargo (de la edición finalizada).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [freeRepeatOpen, setFreeRepeatOpen] = useState(false);
  useEffect(() => setSelected(new Set()), [editionId]);
  /** El admin repite solo los de su grupo; superadmin+, cualquiera. */
  const canSelect = (row: IPollaBetListItem) =>
    canFreeRepeat && !isPublicPollaBet(row) && (isSuper || row.polla_group_id === ownGroupId);
  const toggleSelected = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  // Lo que dice el PDF sobre los filtros con que se armó.
  let pdfScope = mine ? 'Mis jugadas' : 'Todas las jugadas';
  if (selectedUser && !mine) {
    pdfScope = `${POLLA_USER_TYPE_LABEL[selectedUser.user_type]} ${
      selectedUser.number ? `${selectedUser.number} · ` : ''
    }${selectedUser.name}`;
  }
  const resultScope = [
    winner === 'true' ? 'ganadores' : winner === 'false' ? 'no ganadores' : '',
    hits.length ? `${hits.join(', ')} aciertos` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const pdfFiltersLabel = `${pdfScope}${resultScope ? ` · ${resultScope}` : ''} · ${
    sort === 'recent' ? 'más recientes primero' : 'por aciertos'
  }`;
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
      // Cada jugada guarda su precio: el de la edición puede haber cambiado.
      ticketPrice: Number(row.amount ?? edition.ticket_price),
      poolAmount: Number(edition.pool_amount),
      surprisePoolAmount: Number(edition.surprise_pool_amount ?? 0),
      isFree: row.is_free,
    });

    await deliverPdf(blob, fileName, `Ticket Polla ${row.ticket_number}`);
  };

  const { rows, totalCount } = flattenPages(bets?.pages);
  const freeRepeats = useMemo(
    () =>
      Object.assign(
        {},
        ...((bets?.pages ?? []) as BetsFeedPage[]).map((page) => page.free_repeats ?? {})
      ) as Record<string, number>,
    [bets]
  );
  const selectableRows = rows.filter(canSelect);

  // Estado y acciones se comparten entre la tabla (desktop) y las tarjetas (mobile).
  const renderStatus = (row: IPollaBetListItem) => {
    const extra = (
      <>
        {row.is_free && <Badge variant="outline">Sin cargo</Badge>}
        {freeRepeats[row.polla_bet_id] > 0 && (
          <Badge variant="secondary" title="Veces que se repitió sin cargo">
            <Gift className="mr-1 h-3 w-3" />
            {freeRepeats[row.polla_bet_id]}
          </Badge>
        )}
      </>
    );

    let main;
    if (row.winner) {
      main = <Badge variant="success">Ganadora {fmtDate(row.hit_date)}</Badge>;
    } else if (isPublicPollaBet(row)) {
      main = row.is_mine ? (
        <Badge variant="outline">Mía</Badge>
      ) : (
        <Badge variant="secondary">Jugando</Badge>
      );
    } else {
      main = <span className="text-xs text-muted-foreground">{fmtDate(row.load_date)}</span>;
    }

    return (
      <span className="flex flex-wrap items-center gap-1">
        {main}
        {extra}
      </span>
    );
  };

  // Todos leen todo; editar y borrar lo decide la API para cada jugada
  // (`can_edit`/`can_delete`): superadmin+ siempre, el admin en su grupo hasta
  // su corte, el pasador borra lo suyo hasta el cierre (aunque ya se haya
  // liquidado: se descuenta del pase). Imprimir: admin+ y el pasador lo suyo.
  const renderActions = (row: IPollaBetListItem) => {
    const isPublic = isPublicPollaBet(row);
    const canPrint = canManage || (isCashier && isPublic && row.is_mine);
    const canEdit = Boolean(row.can_edit);
    const canDelete = Boolean(row.can_delete);

    if (!canPrint && !canEdit && !canDelete) return null;

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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Editar"
            onClick={() => setEditing(row)}
          >
            <Pencil />
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Eliminar"
            onClick={() => {
              if (
                window.confirm(
                  `¿Eliminar la jugada ${row.ticket_number}? Se descuenta del pase del día en que se borra.`
                )
              ) {
                deleteBet({ id: row.polla_bet_id });
              }
            }}
          >
            <Trash2 />
          </Button>
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
              {Number(selectedEdition.surprise_pool_amount ?? 0) > 0 && (
                <span className="font-semibold text-success">
                  {` + sorpresa $${fmtMoney(selectedEdition.surprise_pool_amount)}`}
                </span>
              )}
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

        {isSuper && (groups?.data.length ?? 0) > 0 && !mine && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Grupo</Label>
            <Select
              value={groupId || 'all'}
              onValueChange={(value) => updateParam('polla_group_id', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {groups?.data.map((group) => (
                  <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isSuper && ownGroupId && !mine && (
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="bets-own-group"
              checked={groupId === ownGroupId}
              onCheckedChange={(checked) =>
                updateParam('polla_group_id', checked === true ? ownGroupId : '')
              }
            />
            <Label htmlFor="bets-own-group" className="cursor-pointer">
              Solo mi grupo
            </Label>
          </div>
        )}

        {!mine && (
          <UserSearchPicker
            id="bets-user"
            label="Filtrar por"
            userTypes={[POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER]}
            typeFilter={{ value: filterType, onChange: changeFilterType }}
            value={selectedUser}
            onChange={(picked) => {
              setPickedType(filterType);
              setPickedUser(picked);
              updateParam(filterParam, picked?.polla_user_id ?? '');
            }}
            placeholder="Todos: número o nombre"
            clearLabel="Todos"
            scope={{ polla_group_id: groupId || null }}
            className="sm:w-[260px]"
          />
        )}

        {canFilterMine && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label id="bets-view-label">Ver</Label>
            <div
              role="tablist"
              aria-labelledby="bets-view-label"
              className="inline-flex rounded-md border bg-card p-1"
            >
              {[
                {
                  value: '1',
                  label: 'Mis jugadas',
                  title:
                    role === POLLA_USER_TYPE.CASHIER
                      ? 'Las tuyas y las de tus jugadores'
                      : 'Las que cargaste',
                },
                { value: '0', label: 'Jugando', title: 'Todas las que se están jugando' },
              ].map((tab) => {
                const active = (mine ? '1' : '0') === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={tab.title}
                    onClick={() => updateParam('mine', tab.value)}
                    className={cn(
                      'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                      active
                        ? 'bg-nav-active text-nav-active-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ResultFilters
          winner={winner}
          onWinnerChange={(value) => updateParam('winner', value)}
          hits={hits}
          onHitsChange={(value) => updateParam('hits', value.join(','))}
        />

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

        <Button
          type="button"
          variant="outline"
          className="gap-2 sm:ml-auto"
          onClick={handleRefresh}
          disabled={!betsEnabled || refreshing}
        >
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </Button>

        {/* El jugador no imprime: tampoco comparte el PDF de tickets. */}
        {hasActions && selectedEdition && !searching && (
          <ShareTicketsPdfButton
            edition={selectedEdition}
            lotteryName={lotteryById.get(selectedEdition.polla_lottery_id) ?? 'Quiniela'}
            scheduleName={scheduleById.get(selectedEdition.polla_schedule_id) ?? 'Turno'}
            filters={{
              ...userFilter,
              winner: winner ? winner === 'true' : undefined,
              hits: resultFilter.hits,
              mine,
              sort,
            }}
            filtersLabel={pdfFiltersLabel}
          />
        )}
      </div>

      {canFreeRepeat && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border bg-card p-3 text-sm text-card-foreground sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-muted-foreground">
            Edición finalizada: elegí tickets (por ejemplo, con los filtros de aciertos) para
            repetirlos sin cargo en una edición nueva.
            {selected.size > 0 && (
              <strong className="text-foreground">{` ${selected.size} elegidos.`}</strong>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectableRows.length === 0}
              onClick={() =>
                setSelected(
                  selected.size === selectableRows.length
                    ? new Set()
                    : new Set(selectableRows.map((row) => row.polla_bet_id))
                )
              }
            >
              {selected.size === selectableRows.length && selected.size > 0
                ? 'Quitar todos'
                : `Elegir los ${selectableRows.length} de la lista`}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setFreeRepeatOpen(true)}
            >
              <Gift />
              Repetir sin cargo
            </Button>
          </div>
        </div>
      )}

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
                  {canSelect(row) && (
                    <Checkbox
                      checked={selected.has(row.polla_bet_id)}
                      onCheckedChange={(checked) =>
                        toggleSelected(row.polla_bet_id, checked === true)
                      }
                      aria-label={`Elegir el ticket ${row.ticket_number}`}
                      className="mt-1"
                    />
                  )}
                  <div className="min-w-0 flex-1">
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
                  {hasActions && <div className="flex gap-1">{renderActions(row)}</div>}
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
                  {canFreeRepeat && <TableHead className="w-8" />}
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
                  {hasActions && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: IPollaBetListItem) => (
                  <TableRow key={row.polla_bet_id}>
                    {canFreeRepeat && (
                      <TableCell>
                        {canSelect(row) && (
                          <Checkbox
                            checked={selected.has(row.polla_bet_id)}
                            onCheckedChange={(checked) =>
                              toggleSelected(row.polla_bet_id, checked === true)
                            }
                            aria-label={`Elegir el ticket ${row.ticket_number}`}
                          />
                        )}
                      </TableCell>
                    )}
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
                    {hasActions && (
                      <TableCell>
                        <div className="flex justify-end gap-1">{renderActions(row)}</div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </InfiniteList>
      )}

      {canManage && <EditBetDialog bet={editing} onClose={() => setEditing(null)} />}
      {freeRepeatOpen && (
        <FreeRepeatDialog
          betIds={[...selected]}
          organizationId={organizationId}
          editionLabel={(edition) =>
            editionLabel(
              edition,
              lotteryById.get(edition.polla_lottery_id),
              scheduleById.get(edition.polla_schedule_id)
            )
          }
          onClose={() => setFreeRepeatOpen(false)}
          onDone={() => setSelected(new Set())}
        />
      )}
    </div>
  );
};

export default BetsPage;
