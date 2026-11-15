import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { IPollaEditionAccountListItem, pollaEditionTitle } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { useEditionAccountList } from '@/hooks/fetchs/usePollaData';
import { EmptyState } from '@/components/PageHeader';
import { fmtMoney } from '../format';
import { EditionAccountDetail } from './EditionAccountDetail';

const fmtDate = (value: string) => dayjs(value).format('DD/MM/YYYY');

const EditionList = ({
  heading,
  emptyMessage,
  items,
  titleOf,
  onSelect,
}: {
  heading: string;
  emptyMessage: string;
  items: IPollaEditionAccountListItem[];
  titleOf: (item: IPollaEditionAccountListItem) => string;
  onSelect: (item: IPollaEditionAccountListItem) => void;
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-base font-semibold">{heading}</h2>
    {items.length === 0 ? (
      <EmptyState message={emptyMessage} />
    ) : (
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.edition.polla_edition_id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full flex-col gap-1 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent"
            >
              <span className="font-medium">{titleOf(item)}</span>
              <span className="text-xs text-muted-foreground">
                {fmtDate(item.edition.start_date)} al {fmtDate(item.edition.end_date)}
              </span>
              <span className="flex flex-wrap justify-between gap-x-4 text-sm">
                <span>
                  {item.liquidated_count} de {item.cashiers_count} pasadores liquidados
                </span>
                <span className="tabular-nums">Debe ${fmtMoney(item.owed)}</span>
              </span>
              {item.liquidated_at && (
                <span className="text-xs text-muted-foreground">
                  Marcada por {item.liquidated_by_name ?? '-'} el{' '}
                  {dayjs(item.liquidated_at).format('DD/MM/YYYY')}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/**
 * Pasadores: la cuenta corriente por edición. Las que todavía no se marcaron
 * como liquidadas van arriba; las demás quedan para consultar.
 */
export const EditionAccountsView = () => {
  const { organizationId } = useAuth();
  const catalogs = useDrawCatalogs(organizationId);
  const { data, isFetching } = useEditionAccountList({
    polla_organization_id: organizationId ?? undefined,
  });

  const [editionId, setEditionId] = useState<string | null>(null);

  const titleOf = (item: IPollaEditionAccountListItem) => pollaEditionTitle(item.edition, catalogs);

  const { pending, done } = useMemo(() => {
    const list = data ?? [];
    return {
      pending: list.filter((item) => item.liquidated_at === null),
      done: list.filter((item) => item.liquidated_at !== null),
    };
  }, [data]);

  const selected = (data ?? []).find((item) => item.edition.polla_edition_id === editionId);
  if (selected) {
    return (
      <EditionAccountDetail
        item={selected}
        title={titleOf(selected)}
        onBack={() => setEditionId(null)}
      />
    );
  }

  if (!data) return <EmptyState message={isFetching ? 'Cargando…' : 'No hay ediciones.'} />;

  return (
    <div className="flex flex-col gap-6">
      <EditionList
        heading="Pollas a liquidar"
        emptyMessage="No hay pollas por liquidar."
        items={pending}
        titleOf={titleOf}
        onSelect={(item) => setEditionId(item.edition.polla_edition_id)}
      />
      <EditionList
        heading="Liquidaciones realizadas"
        emptyMessage="Todavía no hay liquidaciones realizadas."
        items={done}
        titleOf={titleOf}
        onSelect={(item) => setEditionId(item.edition.polla_edition_id)}
      />
    </div>
  );
};
