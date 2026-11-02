import { useMemo, useState } from 'react';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useDailySales } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { DateInput } from '@/components/ui/date-input';
import { todayIso } from '@/lib/dates';
import { groupLabel } from '@/lib/pollaGroups';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GroupSelect } from '@/features/current-account/dialogs/shared';
import { ALL_GROUPS } from '@/features/current-account/format';
import { EditionPicker } from '@/features/bets/EditionPicker';
import { useBetsEdition } from '@/features/bets/useBetsEdition';

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

type SalesView = 'day' | 'edition';

const SALES_VIEWS: [SalesView, string][] = [
  ['day', 'Del día'],
  ['edition', 'Total de la edición'],
];

/**
 * Boletas vendidas (sin las repetidas sin cargo) en el día o, con "Total de la
 * edición", en todos los días de una edición. Superadmin+ ve el total del
 * capitalista y el desglose por grupo, con filtro por grupo o todos; el admin,
 * solo su grupo; el pasador, lo suyo y lo de sus jugadores.
 */
export const SalesPage = () => {
  const { role, organizationId } = useAuth();
  const [view, setView] = useState<SalesView>('day');
  const [date, setDate] = useState(todayIso);
  const [groupId, setGroupId] = useState(ALL_GROUPS);
  // La edición va en la URL, como en Jugadas (abre en la activa más reciente).
  const { editionId, editionList, labelFor, updateEdition } = useBetsEdition();

  const byEdition = view === 'edition';
  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  // El admin recibe solo su grupo: no hay nada que elegir.
  const picksGroup = !isCashier && role !== POLLA_USER_TYPE.ADMIN;
  const { data: sales, isFetching } = useDailySales(
    byEdition
      ? { polla_edition_id: editionId, polla_organization_id: organizationId }
      : { date, polla_organization_id: organizationId },
    !byEdition || Boolean(editionId)
  );
  const { data: groups } = useGroups();

  // El desglose por grupo ya viene completo: el filtro se aplica acá.
  const visibleGroups = useMemo(
    () =>
      (sales?.groups ?? []).filter(
        (group) => groupId === ALL_GROUPS || group.polla_group_id === groupId
      ),
    [sales, groupId]
  );

  const totals =
    groupId === ALL_GROUPS
      ? { bets_count: sales?.bets_count ?? 0, amount: sales?.amount ?? 0 }
      : visibleGroups.reduce(
          (acc, group) => ({
            bets_count: acc.bets_count + group.bets_count,
            amount: acc.amount + group.amount,
          }),
          { bets_count: 0, amount: 0 }
        );

  const period = byEdition ? 'en la edición' : 'en el día';

  return (
    <div>
      <PageHeader
        description={
          isCashier
            ? `Boletas que vendiste ${period}, sumando las de tus jugadores.`
            : picksGroup
              ? `Boletas vendidas ${period}, en total y por grupo.`
              : `Boletas vendidas ${period} en tu grupo.`
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <Label id="sales-view-label">Ver</Label>
          <div
            role="radiogroup"
            aria-labelledby="sales-view-label"
            className="inline-flex rounded-md border bg-card p-1"
          >
            {SALES_VIEWS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => setView(value)}
                className={cn(
                  'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                  view === value
                    ? 'bg-nav-active text-nav-active-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {byEdition ? (
          <EditionPicker
            editions={editionList}
            value={editionId}
            onChange={updateEdition}
            labelFor={labelFor}
          />
        ) : (
          <div className="flex flex-col gap-1 sm:w-[200px]">
            <Label htmlFor="sales-date">Fecha</Label>
            <DateInput id="sales-date" value={date} max={todayIso()} onValueChange={setDate} />
          </div>
        )}

        {picksGroup && (
          <div className="sm:w-[220px]">
            <GroupSelect groups={groups?.data ?? []} value={groupId} onChange={setGroupId} />
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Boletas vendidas</p>
          <p className="text-3xl font-bold tabular-nums">{totals.bets_count}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Recaudado</p>
          <p className="text-3xl font-bold tabular-nums">${fmtMoney(totals.amount)}</p>
        </div>
      </div>

      {sales?.groups &&
        (visibleGroups.length === 0 ? (
          <EmptyState
            message={
              isFetching
                ? 'Cargando…'
                : byEdition
                  ? 'No hubo ventas en la edición'
                  : 'No hubo ventas ese día'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card text-card-foreground lg:max-w-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Boletas</TableHead>
                  <TableHead className="text-right">Recaudado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleGroups.map((group) => (
                  <TableRow key={group.polla_group_id ?? 'none'}>
                    <TableCell>
                      {groupLabel(
                        group.group_name
                          ? { name: group.group_name, number: group.group_number ?? 0 }
                          : null
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{group.bets_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(group.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.bets_count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(totals.amount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ))}
    </div>
  );
};

export default SalesPage;
