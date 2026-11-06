import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { BadgeDollarSign, Gift, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react';
import {
  IPollaBetListItem,
  IPollaUnpaidSummary,
  POLLA_EDITION_STATUS,
  POLLA_HITS_FILTER,
  POLLA_PAYMENT_STATUS,
  POLLA_TICKET_SEARCH,
  isPublicPollaBet,
  pollaTicketCashierCode,
} from '@helper/polla/types/game.type';
import {
  IPollaUserOption,
  POLLA_USER_TYPE,
  POLLA_USER_TYPE_LABEL,
  isPollaAdminRole,
  isPollaLoaderRole,
  isPollaSuperRole,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useBets, useRefreshBets, useUser } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  unpaidQuery,
  useDeleteBet,
  useDeleteUnpaidBets,
  useMarkBetsPaid,
} from '@/hooks/mutations/usePollaMutations';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PollaPage, flattenPages } from '@/hooks/useApi';
import { UserSearchPicker } from '@/components/UserSearchPicker';
import { pollaUserCode, pollaUserOption } from '@/lib/pollaUsers';
import { groupLabel } from '@/lib/pollaGroups';
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
import { makePollaTicketPdf } from '@/functions/makePollaTicket';
import { deliverPdf } from '@/functions/printPdf';
import { BetsList } from '@/features/bets/BetsList';
import { EditBetDialog, EditableBet } from '@/features/bets/EditBetDialog';
import { EditionPicker } from '@/features/bets/EditionPicker';
import { FreeRepeatDialog } from '@/features/bets/FreeRepeatDialog';
import { LoadDateFilter } from '@/features/bets/LoadDateFilter';
import { ResultFilters, WinnerFilter } from '@/features/bets/ResultFilters';
import { ShareTicketsPdfButton } from '@/features/bets/ShareTicketsPdfButton';
import { WinnersBanner } from '@/features/bets/WinnersBanner';
import { useBetsEdition } from '@/features/bets/useBetsEdition';
import { useLoadRangeParam } from '@/features/bets/useLoadRangeParam';

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

/** `hits=10,9` de la URL → aciertos válidos, en el orden de los checkboxes. */
const parseHits = (raw: string | null): number[] =>
  raw ? POLLA_HITS_FILTER.filter((hit) => raw.split(',').map(Number).includes(hit)) : [];

/** Página del feed de jugadas: con cuántas veces se repitió sin cargo cada ticket. */
type BetsFeedPage = PollaPage<IPollaBetListItem> & { free_repeats?: Record<string, number> };

/**
 * Administrar jugadas: lo que administra cada rol (la API lo acota con
 * `view=manage`), con filtros, imprimir, editar, borrar y repetir sin cargo.
 * El pasador ve lo suyo y lo de sus jugadores; el admin, su grupo;
 * superadmin+, toda la organización. El jugador no entra.
 */
export const ManageBetsPage = () => {
  const { user, role, organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    editionId,
    editionList,
    selectedEdition,
    labelFor,
    titleFor,
    drawLabelsFor,
    editionStatusOf,
  } = useBetsEdition();

  const canManage = Boolean(role && isPollaAdminRole(role));
  const isSuper = Boolean(role && isPollaSuperRole(role));
  // Admin+ y el Super editan, imprimen y filtran por cualquier pasador o
  // jugador de su alcance; superadmin+ y el Super ven toda la organización.
  const canLoad = Boolean(role && isPollaLoaderRole(role));
  const orgWide = isSuper || role === POLLA_USER_TYPE.ASSISTANT;
  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  // El admin queda en su grupo: la API ya lo acota, el buscador también.
  const ownGroupId = user?.polla_group_id ?? null;

  const [search, setSearch] = useState(searchParams.get('ticket_number') ?? '');
  const [editing, setEditing] = useState<EditableBet | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  // El pasador no filtra por pasador: todo lo que ve ya es suyo.
  const cashierId = isCashier ? '' : (searchParams.get('cashier_polla_user_id') ?? '');
  const playerId = searchParams.get('polla_user_id') ?? '';
  const sort = searchParams.get('sort') === 'recent' ? 'recent' : 'hits';
  const groupId = orgWide ? (searchParams.get('polla_group_id') ?? '') : '';
  const winnerParam = searchParams.get('winner');
  const winner: WinnerFilter = winnerParam === 'true' || winnerParam === 'false' ? winnerParam : '';
  const hits = parseHits(searchParams.get('hits'));
  // "Impagos": solo los tickets en Debe (R13).
  const onlyOwed = searchParams.get('payment_status') === POLLA_PAYMENT_STATUS.OWED;
  const [loadRange, changeLoadRange] = useLoadRangeParam();

  const { data: groups } = useGroups(
    { polla_organization_id: organizationId ?? undefined },
    orgWide
  );

  // Admin+ filtra por pasador (sus jugadas y las de sus jugadores) o por
  // jugador (solo las suyas); el pasador, solo por uno de sus jugadores. El
  // tipo sale del filtro de la URL; sin filtro, del último elegido en
  // "Pasador | Jugador".
  const [pickedType, setPickedType] = useState(() =>
    isCashier || searchParams.get('polla_user_id')
      ? POLLA_USER_TYPE.PLAYER
      : POLLA_USER_TYPE.CASHIER
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
  // (recarga, link), se trae por id y, para admin+, si es un jugador, también
  // su pasador (el pasador no puede pedirse a sí mismo por id).
  const [pickedUser, setPickedUser] = useState<IPollaUserOption | null>(null);
  const pickedMatches = Boolean(filterUserId) && pickedUser?.polla_user_id === filterUserId;
  // Por id solo se trae a quien se administra (un pasador o jugador ajeno es 403).
  const { data: userFromUrl } = useUser(filterUserId && !pickedMatches ? filterUserId : null);
  const urlUser = userFromUrl?.polla_user_id === filterUserId ? userFromUrl : null;
  const urlCashierId =
    canLoad && urlUser?.user_type === POLLA_USER_TYPE.PLAYER ? urlUser.parent_polla_user_id : null;
  const { data: cashierOfUrlUser } = useUser(urlCashierId);
  const selectedUser = useMemo(() => {
    if (!filterUserId) return null;
    if (pickedMatches) return pickedUser;
    if (!urlUser) return null;
    const cashier = cashierOfUrlUser?.polla_user_id === urlCashierId ? cashierOfUrlUser : null;
    return pollaUserOption(urlUser, cashier);
  }, [filterUserId, pickedMatches, pickedUser, urlUser, urlCashierId, cashierOfUrlUser]);

  // Filtros de grupo, usuario y resultado para la lista y el PDF.
  const userFilter: Record<string, string> = {
    ...(filterUserId ? { [filterParam]: filterUserId } : {}),
    ...(groupId ? { polla_group_id: groupId } : {}),
  };
  const resultFilter = {
    winner: winner || undefined,
    hits: hits.length ? hits.join(',') : undefined,
    payment_status: onlyOwed ? POLLA_PAYMENT_STATUS.OWED : undefined,
  };
  const loadFilter = { load_from: loadRange?.from, load_to: loadRange?.to };

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

  // Un nº de ticket se busca en todas las ediciones (sin los demás filtros);
  // otro texto, el jugador o el identificador del ticket en la edición elegida.
  const searching = POLLA_TICKET_SEARCH.test(debouncedSearch);
  const nameSearch = !searching && debouncedSearch ? debouncedSearch : undefined;

  // Repetir sin cargo: superadmin+ y el admin, con la edición ya finalizada.
  const canFreeRepeat =
    canManage && !searching && selectedEdition?.status === POLLA_EDITION_STATUS.FINISHED;

  const betsParams = {
    view: 'manage',
    polla_edition_id: searching ? undefined : editionId || undefined,
    ticket_number: searching ? debouncedSearch : undefined,
    search: nameSearch,
    ...(searching ? {} : userFilter),
    ...(searching ? {} : resultFilter),
    ...(searching ? {} : loadFilter),
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

  // Lo que dice el PDF sobre los filtros con que se armó (y el alcance del rol).
  let pdfScope = 'Todas las jugadas';
  if (isCashier) pdfScope = 'Mis jugadas';
  else if (!orgWide) pdfScope = 'Mi grupo';
  if (selectedUser) {
    pdfScope = `${POLLA_USER_TYPE_LABEL[selectedUser.user_type]} ${
      selectedUser.number ? `${pollaUserCode(selectedUser)} · ` : ''
    }${selectedUser.name}`;
  }
  // El día de carga lo suma el botón: se elige al compartir.
  const filtersScope = [
    winner === 'true' ? 'ganadores' : winner === 'false' ? 'no ganadores' : '',
    hits.length ? `${hits.join(', ')} aciertos` : '',
    nameSearch ? `"${nameSearch}"` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const pdfFiltersLabel = `${pdfScope}${filtersScope ? ` · ${filtersScope}` : ''} · ${
    sort === 'recent' ? 'más recientes primero' : 'por aciertos'
  }`;
  const { mutate: deleteBet } = useDeleteBet();
  const { mutate: markPaid, isPending: isMarkingPaid } = useMarkBetsPaid();

  const paidToast = ({ updated }: { updated: number }) =>
    toast.success(
      updated === 0
        ? 'No había tickets en Debe para marcar'
        : updated === 1
          ? 'Ticket marcado como pago'
          : `${updated} tickets marcados como pagos`
    );

  /** Debe → Pagado, en efectivo. No se puede volver atrás. */
  const handleMarkPaid = (row: IPollaBetListItem) => {
    if (
      !window.confirm(`¿Marcar como pago el ticket ${row.ticket_number}? No se puede deshacer.`)
    ) {
      return;
    }
    markPaid({ polla_bet_ids: [row.polla_bet_id] }, { onSuccess: paidToast });
  };

  // "Eliminar impagos" (R14): solo el pasador, en la edición elegida y, si
  // filtró un jugador, solo de ese jugador.
  const { mutate: deleteUnpaid, isPending: isDeletingUnpaid } = useDeleteUnpaidBets();
  const [checkingUnpaid, setCheckingUnpaid] = useState(false);
  const handleDeleteUnpaid = async () => {
    if (!editionId) return;
    const target = {
      polla_edition_id: editionId,
      ...(playerId ? { polla_user_id: playerId } : {}),
    };
    setCheckingUnpaid(true);
    let summary: IPollaUnpaidSummary;
    try {
      summary = await apiClient.get<IPollaUnpaidSummary>(
        `${BACKEND_ROUTES.bet.unpaidSummary}?${unpaidQuery(target)}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron contar los impagos');
      return;
    } finally {
      setCheckingUnpaid(false);
    }

    if (!summary.can_delete) {
      toast.error('Cerró la carga de esta edición: ya no se borran tickets');
      return;
    }
    if (summary.count === 0) {
      toast('No hay tickets impagos para eliminar');
      return;
    }

    const whose = selectedUser && playerId ? ` de ${selectedUser.name}` : '';
    const winners =
      summary.winners_skipped > 0
        ? `\n${summary.winners_skipped} en Debe ganaron y no se borran.`
        : '';
    if (
      !window.confirm(
        `¿Eliminar ${summary.count} ${summary.count === 1 ? 'ticket impago' : 'tickets impagos'}${whose} por $${fmtMoney(summary.amount)}? Se descuentan del pase de hoy (Borradas).${winners}`
      )
    ) {
      return;
    }

    deleteUnpaid(target, {
      onSuccess: ({ deleted, amount }) =>
        toast.success(
          `${deleted} ${deleted === 1 ? 'ticket eliminado' : 'tickets eliminados'} ($${fmtMoney(amount)})`
        ),
    });
  };

  // Todos los impagos del jugador filtrado en la edición.
  const playerToCollect =
    !searching && editionId && filterType === POLLA_USER_TYPE.PLAYER && selectedUser
      ? selectedUser
      : null;
  const handleMarkAllPaid = () => {
    if (!playerToCollect) return;
    if (
      !window.confirm(
        `¿Marcar como pagos todos los tickets en Debe de ${playerToCollect.name} en esta edición? No se puede deshacer.`
      )
    ) {
      return;
    }
    markPaid(
      { polla_edition_id: editionId, polla_user_id: playerToCollect.polla_user_id },
      { onSuccess: paidToast }
    );
  };

  const handlePrint = async (row: IPollaBetListItem) => {
    const edition = editionList.find((e) => e.polla_edition_id === row.polla_edition_id);
    if (!edition) return;

    const { blob, fileName } = await makePollaTicketPdf({
      ticket_number: row.ticket_number,
      user_name: isPublicPollaBet(row) ? (row.client_name ?? row.cashier_name) : row.user_name,
      identifier: row.identifier,
      cashier_code: pollaTicketCashierCode(row.ticket_number, row.cashier_number) || undefined,
      numbers: row.numbers,
      editionName: edition.name,
      drawLines: drawLabelsFor(edition),
      startDate: edition.start_date,
      endDate: edition.end_date,
      loadDate: row.load_date,
      loadedAt: row.created_at,
      // Cada jugada guarda su precio: el de la edición puede haber cambiado.
      ticketPrice: Number(row.amount ?? edition.ticket_price),
      poolAmount: Number(edition.pool_amount),
      surprisePoolAmount: Number(edition.surprise_pool_amount ?? 0),
      isFree: row.is_free,
      // El pasador y el Súper reciben el estado de lo que cobran (R13).
      paymentStatus: row.payment_status ?? undefined,
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

  // Editar y borrar lo decide la API para cada jugada (`can_edit`/`can_delete`):
  // superadmin+ siempre, el admin en su grupo y el Super en la organización
  // hasta su corte, el pasador borra lo suyo hasta el cierre (aunque ya se
  // haya liquidado: se descuenta del pase). Imprimir: admin+, el Super y el
  // pasador lo suyo (acá todo es suyo).
  const renderActions = (row: IPollaBetListItem) => {
    const isPublic = isPublicPollaBet(row);
    const canPrint = canLoad || (isCashier && isPublic && row.is_mine);
    const canEdit = Boolean(row.can_edit);
    const canDelete = Boolean(row.can_delete);
    const canPay = Boolean(row.can_mark_paid);

    if (!canPrint && !canEdit && !canDelete && !canPay) return null;

    return (
      <>
        {canPay && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Marcar como pago"
            aria-label={`Marcar como pago el ticket ${row.ticket_number}`}
            disabled={isMarkingPaid}
            onClick={() => handleMarkPaid(row)}
          >
            <BadgeDollarSign />
          </Button>
        )}
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
      <WinnersBanner editionId={editionId} />

      {/* Los filtros ocupan el ancho completo en mobile y se acomodan en línea
          desde sm: en 320px cualquier ancho fijo desborda. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <EditionPicker
          editions={editionList}
          value={editionId}
          onChange={(value) => updateParam('polla_edition_id', value)}
          labelFor={labelFor}
          showCount
        />

        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="manage-bets-search">Buscar</Label>
          <Input
            id="manage-bets-search"
            type="search"
            value={search}
            placeholder="Nº de ticket, jugador o identificador"
            onChange={(e) => setSearch(e.target.value.slice(0, 50))}
            className="w-full sm:w-[260px]"
          />
        </div>

        {orgWide && (groups?.data.length ?? 0) > 0 && (
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
                    {groupLabel(group)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isCashier ? (
          <UserSearchPicker
            id="manage-bets-user"
            label="Jugador"
            userTypes={[POLLA_USER_TYPE.PLAYER]}
            value={selectedUser}
            onChange={(picked) => {
              setPickedUser(picked);
              updateParam('polla_user_id', picked?.polla_user_id ?? '');
            }}
            placeholder="Todos: número o nombre"
            clearLabel="Todos"
            scope={{ parent_polla_user_id: user?.polla_user_id ?? null }}
            className="sm:w-[260px]"
          />
        ) : (
          <UserSearchPicker
            id="manage-bets-user"
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
            scope={{ polla_group_id: (orgWide ? groupId : ownGroupId) || null }}
            className="sm:w-[260px]"
          />
        )}

        <LoadDateFilter value={loadRange} onChange={changeLoadRange} />

        <ResultFilters
          winner={winner}
          onWinnerChange={(value) => updateParam('winner', value)}
          hits={hits}
          onHitsChange={(value) => updateParam('hits', value.join(','))}
        />

        <div className="flex items-center gap-2 sm:pb-2">
          <Checkbox
            id="manage-bets-owed"
            checked={onlyOwed}
            onCheckedChange={(checked) =>
              updateParam('payment_status', checked === true ? POLLA_PAYMENT_STATUS.OWED : '')
            }
          />
          <Label htmlFor="manage-bets-owed" className="cursor-pointer py-1">
            Impagos
          </Label>
        </div>

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

        {isCashier && selectedEdition && !searching && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleDeleteUnpaid}
            disabled={checkingUnpaid || isDeletingUnpaid}
            title={
              playerId
                ? 'Borra los tickets en Debe de este jugador en la edición'
                : 'Borra todos tus tickets en Debe de la edición'
            }
          >
            <Trash2 />
            {checkingUnpaid || isDeletingUnpaid ? 'Revisando…' : 'Eliminar impagos'}
          </Button>
        )}

        {selectedEdition && !searching && (
          <ShareTicketsPdfButton
            edition={selectedEdition}
            title={titleFor(selectedEdition)}
            filters={{
              ...userFilter,
              search: nameSearch,
              winner: winner ? winner === 'true' : undefined,
              hits: resultFilter.hits,
              ...loadFilter,
              sort,
            }}
            filtersLabel={pdfFiltersLabel}
            pickLoadDate
          />
        )}
      </div>

      {playerToCollect && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border bg-card p-3 text-sm text-card-foreground sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-muted-foreground">
            Cobrale a {playerToCollect.name} todo lo que debe en esta edición de una vez.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMarkingPaid}
            onClick={handleMarkAllPaid}
          >
            <BadgeDollarSign />
            Marcar todos sus impagos como pagos
          </Button>
        </div>
      )}

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

      <BetsList
        rows={rows}
        totalCount={totalCount}
        isFetching={isFetching}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        freeRepeats={freeRepeats}
        renderActions={renderActions}
        canCopyTicket
        editionStatusOf={editionStatusOf}
        selection={canFreeRepeat ? { canSelect, selected, onToggle: toggleSelected } : undefined}
      />

      {canLoad && <EditBetDialog bet={editing} onClose={() => setEditing(null)} />}
      {freeRepeatOpen && (
        <FreeRepeatDialog
          betIds={[...selected]}
          organizationId={organizationId}
          editionLabel={labelFor}
          onClose={() => setFreeRepeatOpen(false)}
          onDone={() => setSelected(new Set())}
        />
      )}
    </div>
  );
};

export default ManageBetsPage;
