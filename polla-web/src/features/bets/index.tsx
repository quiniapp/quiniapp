import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { POLLA_TICKET_SEARCH } from '@helper/polla/types/game.type';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useBets, useRefreshBets } from '@/hooks/fetchs/usePollaData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { flattenPages } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { periodLabel } from '@/lib/accountPeriod';
import { BetsList } from './BetsList';
import { EditionPicker } from './EditionPicker';
import { LoadDateFilter } from './LoadDateFilter';
import { ShareTicketsPdfButton } from './ShareTicketsPdfButton';
import { WinnersBanner } from './WinnersBanner';
import { useBetsEdition } from './useBetsEdition';
import { useLoadRangeParam } from './useLoadRangeParam';

/**
 * Jugadas: lo que se está jugando en la organización, de solo lectura e igual
 * para todos los roles (la API manda la versión pública con `view=public`).
 * Siempre por aciertos y, a igual cantidad, lo último cargado primero. El
 * pasador y superiores además filtran por fecha de carga y comparten el PDF de
 * lo que se ve. Los demás filtros, imprimir cada ticket, editar y borrar están
 * en Administrar jugadas.
 */
export const BetsPage = () => {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { editionId, editionList, selectedEdition, lotteryById, scheduleById, labelFor } =
    useBetsEdition();

  // El jugador ve lo cargado al entrar; el resto, además, "Actualizar", la
  // fecha de carga y el PDF.
  const isStaff = role !== POLLA_USER_TYPE.PLAYER;
  const [urlLoadRange, changeLoadRange] = useLoadRangeParam();
  const loadRange = isStaff ? urlLoadRange : null;

  const [search, setSearch] = useState(searchParams.get('ticket_number') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim());
  // Un nº de ticket se busca en todas las ediciones; otro texto, el jugador o
  // el identificador del ticket dentro de la edición elegida.
  const searching = POLLA_TICKET_SEARCH.test(debouncedSearch);
  const nameSearch = !searching && debouncedSearch ? debouncedSearch : undefined;
  // "Mis jugadas": el pasador, lo suyo y lo de sus jugadores; el resto, lo suyo.
  const mine = searchParams.get('mine') === '1';

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const loadFilter = searching ? {} : { load_from: loadRange?.from, load_to: loadRange?.to };

  const betsParams = {
    view: 'public',
    polla_edition_id: searching ? undefined : editionId || undefined,
    ticket_number: searching ? debouncedSearch : undefined,
    search: nameSearch,
    mine: mine ? 'true' : undefined,
    ...loadFilter,
    sort: 'hits',
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

  const { rows, totalCount } = flattenPages(bets?.pages);

  // Lo que dice el PDF sobre lo que se está viendo.
  const pdfFiltersLabel = [
    mine ? 'Mis jugadas' : 'Todas las jugadas',
    loadRange ? `cargadas ${periodLabel(loadRange.from, loadRange.to)}` : '',
    nameSearch ? `"${nameSearch}"` : '',
    'por aciertos',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <WinnersBanner editionId={editionId} />

      {/* Los controles ocupan el ancho completo en mobile y se acomodan en
          línea desde sm: en 320px cualquier ancho fijo desborda. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <EditionPicker
          editions={editionList}
          value={editionId}
          onChange={(value) => updateParam('polla_edition_id', value)}
          labelFor={labelFor}
        />

        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="bets-search">Buscar</Label>
          <Input
            id="bets-search"
            type="search"
            value={search}
            placeholder="Nº de ticket, jugador o identificador"
            onChange={(e) => setSearch(e.target.value.slice(0, 50))}
            className="w-full sm:w-[260px]"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Label id="bets-view-label">Ver</Label>
          <div
            role="tablist"
            aria-labelledby="bets-view-label"
            className="inline-flex rounded-md border bg-card p-1"
          >
            {[
              { value: '', label: 'Todas', title: 'Todas las que se están jugando' },
              {
                value: '1',
                label: 'Mis jugadas',
                title:
                  role === POLLA_USER_TYPE.CASHIER
                    ? 'Las tuyas y las de tus jugadores'
                    : 'Las tuyas',
              },
            ].map((tab) => {
              const active = (mine ? '1' : '') === tab.value;
              return (
                <button
                  key={tab.label}
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

        {isStaff && <LoadDateFilter value={loadRange} onChange={changeLoadRange} />}

        {isStaff && (
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
        )}

        {isStaff && selectedEdition && !searching && (
          <ShareTicketsPdfButton
            edition={selectedEdition}
            lotteryName={lotteryById.get(selectedEdition.polla_lottery_id) ?? 'Quiniela'}
            scheduleName={scheduleById.get(selectedEdition.polla_schedule_id) ?? 'Turno'}
            filters={{
              view: 'public',
              search: nameSearch,
              mine,
              load_from: loadRange?.from,
              load_to: loadRange?.to,
              sort: 'hits',
            }}
            filtersLabel={pdfFiltersLabel}
          />
        )}
      </div>

      <BetsList
        rows={rows}
        totalCount={totalCount}
        isFetching={isFetching}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        canCopyTicket={isStaff}
      />
    </div>
  );
};

export default BetsPage;
