import { useState } from 'react';
import dayjs from 'dayjs';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  IPollaUserEditionAccount,
  POLLA_ACCOUNT_MOVEMENT_LABEL,
  pollaEditionTitle,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { useEditionMovements, useMyEditionAccounts } from '@/hooks/fetchs/usePollaData';
import { EmptyState, ErrorState } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { owedWord } from '@/lib/editionAccount';
import { fmtMoney } from '../format';
import { EditionBetsTables } from './EditionBetsTables';

const fmtDate = (value: string) => dayjs(value).format('DD/MM/YYYY');

const FIELDS = [
  ['bets_pass', 'Pase jugadas'],
  ['deleted_pass', 'Borradas'],
  ['pass', 'Pase'],
  ['cashier_commission', 'Comisión'],
  ['claims', 'Reclamos'],
  ['subtotal', 'Subtotal'],
  ['collections', 'Cobros'],
  ['paid', 'Pagos'],
] as const;

/** `Debe` si el pasador tiene que pasar plata (o está en cero); `Cobra` si le deben a él. */
const OwedLabel = ({ total }: { total: number }) => (
  <>
    {owedWord(total)} ${fmtMoney(Math.abs(Number(total)))}
  </>
);

/** Sus cobros, pagos y reclamos en la edición (solo lectura). */
const CashierMovements = ({ editionId, userId }: { editionId: string; userId: string }) => {
  const { data: movements = [] } = useEditionMovements(editionId, userId);

  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Movimientos</h3>
      {movements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay movimientos en la edición.</p>
      ) : (
        <ul aria-label="Movimientos" className="rounded-md border bg-card px-3">
          {movements.map((movement) => (
            <li
              key={movement.polla_edition_account_movement_id}
              className="flex flex-col border-b py-2 text-sm last:border-0"
            >
              <span>
                {fmtDate(movement.date)} · {POLLA_ACCOUNT_MOVEMENT_LABEL[movement.type]} ·{' '}
                <span className="font-medium tabular-nums">${fmtMoney(movement.amount)}</span>
              </span>
              {movement.note && (
                <span className="truncate text-xs text-muted-foreground">{movement.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const CashierEditionDetail = ({
  item,
  title,
  onBack,
}: {
  item: IPollaUserEditionAccount;
  title: string;
  onBack: () => void;
}) => {
  const { edition, account } = item;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onBack}>
          <ArrowLeft />
          Volver
        </Button>
        <h2 className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {fmtDate(edition.start_date)} al {fmtDate(edition.end_date)}
      </p>

      <div className="rounded-xl border bg-card p-4 text-card-foreground">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2 border-b pb-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">${fmtMoney(account[key])}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-right text-lg font-bold tabular-nums">
          <OwedLabel total={account.total} />
        </p>
      </div>

      <CashierMovements editionId={edition.polla_edition_id} userId={account.polla_user_id} />
      {account.differs && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          Tus tickets cambiaron desde la liquidación: el resumen de arriba es el de la liquidación y
          la lista de abajo muestra los tickets de hoy, así que pueden no sumar igual.
        </p>
      )}
      <EditionBetsTables editionId={edition.polla_edition_id} />
    </div>
  );
};

/** Las ediciones donde lo liquidaron: su Debe y, al entrar, el detalle. */
export const CashierEditionAccounts = () => {
  const { organizationId } = useAuth();
  const catalogs = useDrawCatalogs(organizationId);
  const { data, isFetching, isError, refetch } = useMyEditionAccounts();
  const [editionId, setEditionId] = useState<string | null>(null);

  const titleOf = (item: IPollaUserEditionAccount) => pollaEditionTitle(item.edition, catalogs);

  const selected = data?.find((item) => item.edition.polla_edition_id === editionId);
  if (selected) {
    return (
      <CashierEditionDetail
        item={selected}
        title={titleOf(selected)}
        onBack={() => setEditionId(null)}
      />
    );
  }

  if (isError && !data) return <ErrorState onRetry={() => void refetch()} />;
  if (!data) return <EmptyState message={isFetching ? 'Cargando…' : 'No se pudo cargar.'} />;
  if (data.length === 0) return <EmptyState message="Todavía no tenés ediciones liquidadas" />;

  return (
    <ul className="flex flex-col gap-2">
      {data.map((item) => (
        <li key={item.edition.polla_edition_id}>
          <button
            type="button"
            onClick={() => setEditionId(item.edition.polla_edition_id)}
            className="flex w-full flex-col gap-1 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent"
          >
            <span className="font-medium">{titleOf(item)}</span>
            <span className="text-xs text-muted-foreground">
              {fmtDate(item.edition.start_date)} al {fmtDate(item.edition.end_date)}
            </span>
            <span className="text-right text-sm tabular-nums">
              <OwedLabel total={item.account.total} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
