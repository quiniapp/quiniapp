import { useMemo, useState, useEffect, Suspense, lazy, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/button/IconButton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import { Search, X } from 'lucide-react';
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
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { IPollaEditionEntityFront, POLLA_EDITION_STATUS } from '@helper/types/polla-edition.type';
import { IPollaBetEntityFront } from '@helper/types/polla-bet.type';
import { usePollaEditions } from '@/hooks/fetchs/polla-edition/usePollaEditions';
import { usePollaBets } from '@/hooks/fetchs/polla-bet/usePollaBets';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useUpdatePollaBet } from '@/hooks/mutations/polla-bet/useUpdatePollaBet';
import { useDeletePollaBet } from '@/hooks/mutations/polla-bet/useDeletePollaBet';
import { PollaNumberBoxes, pollaNumbersError } from '@/components/PollaNumberGrid';
import { LoadingState } from '@/components/molecules/LoadingState';

const ALL = '__all__';
type PollaView = 'loaded' | 'playing';
const MAX_DATE = dayjs().add(2, 'year').toDate();

const currency = (n?: number) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    : '';

const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD-MM-YYYY') : '-');

const PollaContent = () => {
  const { role, user } = useAuth();
  const isCashier = role === USER_TYPE.CASHIER;

  const [searchParams, setSearchParams] = useSearchParams();
  const pollaEditionId = searchParams.get('polla_edition_id') ?? '';
  const cashierId = searchParams.get('cashier_id') ?? '';
  const view = (searchParams.get('view') as PollaView) ?? 'loaded';
  const selectedDay = searchParams.get('date') ?? dayjs().format('YYYY-MM-DD');
  const ticketNumberQuery = searchParams.get('ticket_number') ?? '';
  const isSearching = !!ticketNumberQuery;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumbers, setEditNumbers] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ticketInput, setTicketInput] = useState(ticketNumberQuery);

  const { data: editions } = usePollaEditions();
  const { data: lotteries } = useLotteries({ all: true });
  const { data: schedules } = useSchedules({ all: true });
  const { data: users } = useUsers(role);

  const lotteryNameById = useMemo(() => {
    const map = new Map<string, string>();
    lotteries?.forEach((l) => map.set(l.lottery_id, l.name));
    return map;
  }, [lotteries]);

  const scheduleNameById = useMemo(() => {
    const map = new Map<string, string>();
    schedules?.forEach((s) => map.set(s.schedule_id, s.name));
    return map;
  }, [schedules]);

  const editionLabel = (e: IPollaEditionEntityFront) =>
    `${lotteryNameById.get(e.lottery_id) ?? e.lottery_id} · ${
      scheduleNameById.get(e.schedule_id) ?? e.schedule_id
    } (${fmtDate(e.start_date)} al ${fmtDate(e.end_date)})${
      e.status === POLLA_EDITION_STATUS.FINISHED ? ' · Finalizada' : ''
    }`;

  // "Cargadas": ediciones que todavía aceptan carga el día seleccionado (antes de
  // su fecha límite). "Jugando": ediciones cuya semana de juego incluye el día
  // seleccionado (entre start_date y end_date). Una edición nunca aparece en
  // ambas vistas el mismo día: mientras se carga para la semana que viene, la
  // semana actual (otra edición) es la que está jugando.
  const loadingEditions = useMemo(
    () => (editions ?? []).filter((e) => selectedDay < e.load_limit_date),
    [editions, selectedDay]
  );
  const playingEditions = useMemo(
    () => (editions ?? []).filter((e) => selectedDay >= e.start_date && selectedDay <= e.end_date),
    [editions, selectedDay]
  );
  const availableEditions = view === 'playing' ? playingEditions : loadingEditions;

  const selectedEdition = availableEditions.find((e) => e.polla_edition_id === pollaEditionId);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === ALL || !value) params.delete(key);
    else params.set(key, value);
    setSearchParams(params);
  };

  // Si la edición elegida no es válida para la vista/día actual (o no hay
  // ninguna elegida todavía), cae a la primera disponible para esa vista.
  useEffect(() => {
    if (isSearching) return;
    if (availableEditions.some((e) => e.polla_edition_id === pollaEditionId)) return;
    const params = new URLSearchParams(searchParams);
    if (availableEditions.length > 0) {
      params.set('polla_edition_id', availableEditions[0].polla_edition_id);
    } else {
      params.delete('polla_edition_id');
    }
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedDay, availableEditions, isSearching]);

  const handleSearchSubmit = () => {
    const params = new URLSearchParams(searchParams);
    const trimmed = ticketInput.trim();
    if (trimmed) params.set('ticket_number', trimmed);
    else params.delete('ticket_number');
    setSearchParams(params);
  };

  const clearSearch = () => {
    setTicketInput('');
    const params = new URLSearchParams(searchParams);
    params.delete('ticket_number');
    setSearchParams(params);
  };

  // Cajero: siempre carga/ve a sí mismo. Admin/owner: eligen un pasador; sin
  // pasador elegido no pueden cargar (necesitan a nombre de quién cargar).
  const resolvedUserId = isCashier ? (user?.user_id ?? null) : cashierId || null;
  const resolvedUserName = isCashier
    ? (user?.name ?? '')
    : (users?.find((u) => u.user_id === cashierId)?.name ?? '');

  const {
    data: bets,
    isLoading,
    isError,
    error: betsError,
  } = usePollaBets(
    isSearching
      ? { ticket_number: ticketNumberQuery, enabled: true }
      : {
          polla_edition_id: pollaEditionId || undefined,
          cashier_id: !isCashier && cashierId ? cashierId : undefined,
          enabled: !!pollaEditionId,
        }
  );

  const sortedBets = useMemo(() => {
    if (!bets) return [];
    if (isSearching) return bets;
    if (view === 'playing') {
      return [...bets].sort(
        (a, b) => b.hits - a.hits || (a.ticket_number ?? '').localeCompare(b.ticket_number ?? '')
      );
    }
    return [...bets].sort((a, b) => (b.load_date ?? '').localeCompare(a.load_date ?? ''));
  }, [bets, view, isSearching]);

  // Fase real de la edición de una jugada puntual (independiente de la vista
  // actual), usada para el estado y los permisos de editar/borrar por fila —
  // así funciona igual en modo búsqueda que en modo navegación.
  const today = dayjs().format('YYYY-MM-DD');
  const editionOf = (bet: IPollaBetEntityFront) =>
    editions?.find((e) => e.polla_edition_id === bet.polla_edition_id);
  const isBetPlaying = (bet: IPollaBetEntityFront) => {
    const edition = editionOf(bet);
    return !!edition && today >= edition.start_date && today <= edition.end_date;
  };
  const canEditBet = (bet: IPollaBetEntityFront) => {
    if (isCashier || bet.winner) return false;
    const edition = editionOf(bet);
    return !!edition && today <= edition.load_limit_date;
  };

  const { mutate: updateBet, isPending: isUpdating } = useUpdatePollaBet(undefined, {
    onSuccess: () => setEditingId(null),
  });
  const { mutate: deleteBet, isPending: isDeleting } = useDeletePollaBet(undefined, {
    onSuccess: () => setConfirmDeleteId(null),
  });

  const startEdit = (betId: string, numbers: string[]) => {
    setEditingId(betId);
    setEditNumbers(numbers);
    setConfirmDeleteId(null);
  };

  const saveEdit = (polla_bet_id: string) => {
    const error = pollaNumbersError(editNumbers);
    if (error) {
      toast.error(error);
      return;
    }
    updateBet({ polla_bet_id, numbers: editNumbers });
  };

  const totalCols = 7;

  return (
    <Box className="grid grid-rows-[auto_1fr] h-full">
      <HeaderSection title="Polla">
        <Button
          onClick={() => setCreateModalOpen(true)}
          disabled={!resolvedUserId}
          title={!resolvedUserId ? 'Seleccioná un pasador primero' : undefined}
          className="gap-2"
        >
          <Plus size={20} />
          Cargar Jugada
        </Button>
      </HeaderSection>

      <FlexCol className="gap-3 p-4 overflow-hidden min-h-0">
        <Flex className="items-end gap-2 flex-wrap">
          <FlexCol className="gap-1">
            <Label className="text-xs">Buscar por número de ticket</Label>
            <Flex className="gap-1">
              <Input
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Ej: 20260921120614717-1"
                className="min-w-[220px]"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleSearchSubmit}>
                <Search size={16} />
              </Button>
              {isSearching && (
                <Button type="button" variant="outline" size="icon" onClick={clearSearch}>
                  <X size={16} />
                </Button>
              )}
            </Flex>
          </FlexCol>
        </Flex>

        {!isSearching && (
        <Flex className="items-center gap-3 flex-wrap">
          <FlexCol className="gap-1">
            <Label className="text-xs">Vista</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => updateParam('view', 'loaded')}
                className={cn(
                  'px-3 py-1.5 text-sm',
                  view === 'loaded' ? 'bg-primary text-primary-foreground' : 'bg-[#10121A]'
                )}
              >
                Cargadas
              </button>
              <button
                type="button"
                onClick={() => updateParam('view', 'playing')}
                className={cn(
                  'px-3 py-1.5 text-sm',
                  view === 'playing' ? 'bg-primary text-primary-foreground' : 'bg-[#10121A]'
                )}
              >
                Jugando
              </button>
            </div>
          </FlexCol>

          <FlexCol className="gap-1">
            <Label className="text-xs">Día</Label>
            <SelectDayToSearch
              selectedDay={selectedDay}
              onDayChange={(d) => d && updateParam('date', d)}
              toDate={MAX_DATE}
            />
          </FlexCol>

          <FlexCol className="gap-1">
            <Label className="text-xs">Edición</Label>
            <Select
              value={pollaEditionId || ALL}
              onValueChange={(v) => updateParam('polla_edition_id', v)}
            >
              <SelectTrigger className="min-w-[280px] bg-[var(--bg-card)]">
                <SelectValue placeholder="Seleccionar edición" />
              </SelectTrigger>
              <SelectContent>
                {availableEditions.map((e) => (
                  <SelectItem key={e.polla_edition_id} value={e.polla_edition_id}>
                    {editionLabel(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FlexCol>

          {!isCashier && (
            <FlexCol className="gap-1">
              <Label className="text-xs">Pasador</Label>
              <Select value={cashierId || ALL} onValueChange={(v) => updateParam('cashier_id', v)}>
                <SelectTrigger className="min-w-[200px] bg-[var(--bg-card)]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.name} - {u.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FlexCol>
          )}

          {selectedEdition && (
            <span className="text-sm text-muted-foreground">
              Pozo: {currency(selectedEdition.pool_amount)} · Carga hasta{' '}
              {fmtDate(selectedEdition.load_limit_date)}
            </span>
          )}
        </Flex>
        )}

        {!isSearching && availableEditions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {view === 'playing'
              ? 'Ninguna edición está jugándose ese día.'
              : 'Ninguna edición acepta carga ese día.'}
          </p>
        )}

        {!isSearching && availableEditions.length > 0 && !pollaEditionId && (
          <p className="text-sm text-muted-foreground">Seleccioná una edición para ver jugadas.</p>
        )}

        {(isSearching || pollaEditionId) && isLoading && (
          <p className="text-sm text-muted-foreground">Cargando jugadas...</p>
        )}

        {(isSearching || pollaEditionId) && isError && (
          <p className="text-sm text-destructive">
            Error al cargar las jugadas: {betsError instanceof Error ? betsError.message : 'desconocido'}
          </p>
        )}

        {(isSearching || pollaEditionId) && !isLoading && !isError && sortedBets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isSearching ? 'No se encontró ninguna jugada con ese ticket.' : 'Todavía no hay jugadas cargadas.'}
          </p>
        )}

        {(isSearching || pollaEditionId) && sortedBets.length > 0 && (
          <div className="overflow-auto flex-1 min-h-0">
            <Table className="w-full min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-[#06081322] h-11">
                  <TableHead>Ticket</TableHead>
                  <TableHead>Pasador</TableHead>
                  <TableHead>Números</TableHead>
                  <TableHead>Fecha de carga</TableHead>
                  <TableHead>Aciertos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBets.map((bet) => {
                  const isEditing = editingId === bet.polla_bet_id;
                  const canModifyRow = canEditBet(bet);

                  return (
                    <Fragment key={bet.polla_bet_id}>
                      <TableRow className={cn(bet.winner && 'bg-green-500/10')}>
                        <TableCell className="font-bold text-primary whitespace-nowrap">
                          {bet.ticket_number}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{bet.user_name}</TableCell>
                        <TableCell className="font-mono">
                          {!isEditing && (
                            <Flex className="gap-1 flex-wrap">
                              {bet.numbers.map((n, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold',
                                    bet.hit_numbers.includes(n)
                                      ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                                      : 'bg-[#10121A] text-muted-foreground border border-border'
                                  )}
                                >
                                  {n}
                                </span>
                              ))}
                            </Flex>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(bet.load_date)}</TableCell>
                        <TableCell className="font-semibold whitespace-nowrap">
                          {bet.hits}/10
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {bet.winner
                            ? `Ganador · ${currency(bet.prize)}`
                            : isBetPlaying(bet)
                              ? 'En juego'
                              : 'Cargada'}
                        </TableCell>
                        <TableCell>
                          {canModifyRow && !isEditing && (
                            <Flex className="gap-1">
                              <IconButton
                                label="Editar"
                                variant="outline"
                                onClick={() => startEdit(bet.polla_bet_id, bet.numbers)}
                              />
                              <IconButton
                                label="Borrar"
                                variant="destructive"
                                onClick={() => setConfirmDeleteId(bet.polla_bet_id)}
                              />
                            </Flex>
                          )}
                        </TableCell>
                      </TableRow>

                      {isEditing && (
                        <TableRow>
                          <TableCell colSpan={totalCols}>
                            <FlexCol className="gap-2">
                              <PollaNumberBoxes values={editNumbers} onChange={setEditNumbers} />
                              <Flex className="gap-2 max-w-md">
                                <IconButton
                                  label="Cancelar"
                                  variant="outline"
                                  onClick={() => setEditingId(null)}
                                  disabled={isUpdating}
                                  className="w-full"
                                />
                                <IconButton
                                  label={isUpdating ? 'Guardando...' : 'Guardar'}
                                  onClick={() => saveEdit(bet.polla_bet_id)}
                                  disabled={isUpdating}
                                  className="w-full"
                                />
                              </Flex>
                            </FlexCol>
                          </TableCell>
                        </TableRow>
                      )}

                      {confirmDeleteId === bet.polla_bet_id && (
                        <TableRow>
                          <TableCell colSpan={totalCols}>
                            <Flex className="gap-2 items-center max-w-md">
                              <Label className="text-xs flex-1">¿Borrar esta jugada?</Label>
                              <IconButton
                                label="Cancelar"
                                variant="outline"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isDeleting}
                              />
                              <IconButton
                                label={isDeleting ? 'Borrando...' : 'Confirmar'}
                                variant="destructive"
                                onClick={() => deleteBet(bet.polla_bet_id)}
                                disabled={isDeleting}
                              />
                            </Flex>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </FlexCol>

      <Suspense fallback={<LoadingState />}>
        <CreatePollaBetModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          userId={resolvedUserId}
          userName={resolvedUserName}
        />
      </Suspense>
    </Box>
  );
};

const CreatePollaBetModal = lazy(() => import('@/components/modals/CreatePollaBetModal'));

export default PollaContent;
