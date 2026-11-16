import { useState } from 'react';
import dayjs from 'dayjs';
import { IPollaEditionAccountListItem, pollaEditionTitle } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { useDoneEditionAccounts, useEditionAccountList } from '@/hooks/fetchs/usePollaData';
import { flattenPages } from '@/hooks/useApi';
import { EmptyState, ErrorState } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { Badge } from '@/components/ui/badge';
import { owedSummary } from '../format';
import { EditionAccountDetail } from './EditionAccountDetail';

const fmtDate = (value: string) => dayjs(value).format('DD/MM/YYYY');

/** "Pollas a liquidar" casi siempre son pocas: se traen de una (hasta 200). */
const PENDING_LIMIT = 200;

const EditionCard = ({
  item,
  title,
  onSelect,
}: {
  item: IPollaEditionAccountListItem;
  title: string;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className="flex w-full flex-col gap-1 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent"
  >
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{title}</span>
      {item.load_open && <Badge variant="outline">Carga abierta</Badge>}
    </span>
    <span className="text-xs text-muted-foreground">
      {fmtDate(item.edition.start_date)} al {fmtDate(item.edition.end_date)}
    </span>
    <span className="flex flex-wrap justify-between gap-x-4 text-sm">
      <span>
        {item.liquidated_count ?? 0} de {item.cashiers_count ?? 0} pasadores liquidados
      </span>
      <span className="tabular-nums">
        {owedSummary(item.owed_by_cashiers ?? 0, item.owed_to_cashiers ?? 0)}
      </span>
    </span>
    {item.liquidated_at && (
      <span className="text-xs text-muted-foreground">
        Marcada por {item.liquidated_by_name ?? '-'} el{' '}
        {dayjs(item.liquidated_at).format('DD/MM/YYYY')}
      </span>
    )}
  </button>
);

/**
 * Pasadores: la cuenta corriente por edición. Las que todavía no se liquidaron
 * van arriba; las liquidaciones realizadas, debajo y de a páginas (scroll
 * infinito).
 */
export const EditionAccountsView = () => {
  const { organizationId } = useAuth();
  const catalogs = useDrawCatalogs(organizationId);
  const scope = { polla_organization_id: organizationId ?? undefined };

  const pending = useEditionAccountList({ ...scope, status: 'pending', limit: PENDING_LIMIT });
  const done = useDoneEditionAccounts(scope);
  const { rows: doneRows, totalCount: doneTotal } = flattenPages(done.data?.pages);
  const pendingRows = pending.data?.data ?? [];

  // Se guarda la edición abierta (no solo el id): al generar la liquidación
  // pasa de una lista a la otra y por un momento no está en ninguna.
  const [selected, setSelected] = useState<IPollaEditionAccountListItem | null>(null);
  const titleOf = (item: IPollaEditionAccountListItem) => pollaEditionTitle(item.edition, catalogs);

  if (selected) {
    const id = selected.edition.polla_edition_id;
    const fresh =
      pendingRows.find((item) => item.edition.polla_edition_id === id) ??
      doneRows.find((item) => item.edition.polla_edition_id === id) ??
      selected;
    return (
      <EditionAccountDetail item={fresh} title={titleOf(fresh)} onBack={() => setSelected(null)} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Pollas a liquidar</h2>
        {pending.isError && !pending.data ? (
          <ErrorState onRetry={() => void pending.refetch()} />
        ) : !pending.data ? (
          <EmptyState message="Cargando…" />
        ) : pendingRows.length === 0 ? (
          <EmptyState message="No hay pollas por liquidar." />
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingRows.map((item) => (
              <li key={item.edition.polla_edition_id}>
                <EditionCard item={item} title={titleOf(item)} onSelect={() => setSelected(item)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Liquidaciones realizadas</h2>
        {done.isError && !done.data ? (
          <ErrorState onRetry={() => void done.refetch()} />
        ) : !done.data ? (
          <EmptyState message="Cargando…" />
        ) : doneRows.length === 0 ? (
          <EmptyState message="Todavía no hay liquidaciones realizadas." />
        ) : (
          <InfiniteList
            totalCount={doneTotal}
            loadedCount={doneRows.length}
            hasNextPage={Boolean(done.hasNextPage)}
            isFetchingNextPage={done.isFetchingNextPage}
            fetchNextPage={() => void done.fetchNextPage()}
          >
            <ul className="flex flex-col gap-2">
              {doneRows.map((item) => (
                <li key={item.edition.polla_edition_id}>
                  <EditionCard
                    item={item}
                    title={titleOf(item)}
                    onSelect={() => setSelected(item)}
                  />
                </li>
              ))}
            </ul>
          </InfiniteList>
        )}
      </section>
    </div>
  );
};
