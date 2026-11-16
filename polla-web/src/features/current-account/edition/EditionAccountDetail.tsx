import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  IPollaEditionAccountListItem,
  IPollaEditionAccountRow,
  POLLA_LIQUIDATION_NO_GROUP,
} from '@helper/polla/types/game.type';
import { IPollaUserOption, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditionAccounts } from '@/hooks/fetchs/usePollaData';
import { EmptyState, ErrorState } from '@/components/PageHeader';
import { UserSearchPicker } from '@/components/UserSearchPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupLabel } from '@/lib/pollaGroups';
import { fmtMoney } from '../format';
import { EditionReportDialog, EditionReportKind } from './EditionReportDialog';
import { GenerateEditionLiquidationDialog } from './GenerateEditionLiquidationDialog';
import { MovementsDialog } from './MovementsDialog';
import { useCashierCode } from './useCashierCode';

const REPORT_BUTTONS: [EditionReportKind, string][] = [
  ['daily', 'Exportar diario'],
  ['liquidation', 'Exportar liquidación'],
  ['subtotals', 'Exportar subtotales'],
  ['collections', 'Exportar cobros y pagos'],
  ['summary', 'Resumen cuenta corriente'],
];

const MONEY_COLUMNS = [
  ['bets_pass', 'Pase jugadas'],
  ['deleted_pass', 'Borradas'],
  ['pass', 'Pase'],
  ['cashier_commission', 'Comisión'],
  ['claims', 'Reclamos'],
  ['subtotal', 'Subtotal'],
  ['collections', 'Cobros'],
  ['paid', 'Pagos'],
  ['total', 'Debe'],
] as const;

type MoneyKey = (typeof MONEY_COLUMNS)[number][0];

/** Lo que muestra la tarjeta del celular (el Debe va aparte, destacado). */
const CARD_FIELDS = [
  ['pass', 'Pase'],
  ['cashier_commission', 'Comisión'],
  ['claims', 'Reclamos'],
  ['subtotal', 'Subtotal'],
  ['collections', 'Cobros'],
  ['paid', 'Pagos'],
] as const;

/** Liquidado y el aviso de que cambió desde la última liquidación. */
const RowStatus = ({ row }: { row: IPollaEditionAccountRow }) => (
  <span className="flex shrink-0 items-center gap-2">
    {row.liquidation && <Badge variant="success">Liquidado</Badge>}
    {row.differs && (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label="Cambió desde la última liquidación"
            className="text-amber-600"
          >
            <AlertTriangle className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Cambió desde la última liquidación</TooltipContent>
      </Tooltip>
    )}
  </span>
);

const sumColumns = (rows: IPollaEditionAccountRow[]) =>
  Object.fromEntries(
    MONEY_COLUMNS.map(([key]) => [key, rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)])
  ) as Record<MoneyKey, number>;

/**
 * Cuenta de cada pasador en una edición, con filtros de grupo y pasador. Tocar
 * una fila abre sus movimientos. "Generar liquidación" liquida a los pasadores
 * del filtro (con lo que se suma hoy en reclamos, cobros y pagos) y pasa la
 * edición a la lista de liquidaciones realizadas; después se sigue editando a
 * medida que los pasadores pagan.
 */
export const EditionAccountDetail = ({
  item,
  title,
  onBack,
}: {
  item: IPollaEditionAccountListItem;
  title: string;
  onBack: () => void;
}) => {
  const editionId = item.edition.polla_edition_id;
  const { organizationId } = useAuth();
  const { groups, cashierCode } = useCashierCode();

  const [groupId, setGroupId] = useState('');
  const [cashier, setCashier] = useState<IPollaUserOption | null>(null);
  const [moving, setMoving] = useState<IPollaEditionAccountRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<EditionReportKind | null>(null);

  // "Sin grupo" no es un filtro de la API: se acota acá abajo.
  const noGroup = groupId === POLLA_LIQUIDATION_NO_GROUP;
  const { data, isFetching, isError, refetch } = useEditionAccounts(editionId, {
    polla_group_id: groupId && !noGroup ? groupId : undefined,
    polla_user_id: cashier?.polla_user_id,
  });
  const rows = useMemo(
    () => (data ?? []).filter((row) => !noGroup || !row.polla_group_id),
    [data, noGroup]
  );
  const totals = useMemo(() => sumColumns(rows), [rows]);

  const openMovements = (row: IPollaEditionAccountRow) => setMoving(row);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onBack}>
          <ArrowLeft />
          Volver
        </Button>
        <h2 className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_BUTTONS.map(([kind, label]) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReport(kind)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <Label>Grupo</Label>
          <Select value={groupId || 'all'} onValueChange={(v) => setGroupId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="Grupo">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
                  {groupLabel(group)}
                </SelectItem>
              ))}
              <SelectItem value={POLLA_LIQUIDATION_NO_GROUP}>Sin grupo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <UserSearchPicker
          id="edition-account-cashier"
          label="Pasador"
          userTypes={[POLLA_USER_TYPE.CASHIER]}
          value={cashier}
          onChange={setCashier}
          placeholder="Todos: número o nombre"
          clearLabel="Todos"
          className="sm:w-[260px]"
        />

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            disabled={rows.length === 0 || item.load_open}
            title={rows.length === 0 ? 'No hay pasadores con este filtro' : undefined}
            onClick={() => setGenerating(true)}
          >
            Generar liquidación
          </Button>
          {item.load_open && (
            <span className="text-xs text-muted-foreground">La carga todavía no cerró</span>
          )}
        </div>
      </div>

      {isError && !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={isFetching ? 'Cargando…' : 'No hay pasadores con jugadas ni movimientos.'}
        />
      ) : (
        <>
          {/* Celular: una tarjeta por pasador; tocarla abre sus movimientos. */}
          <ul className="flex flex-col gap-2 md:hidden" aria-label="Pasadores">
            {rows.map((row) => {
              const code = cashierCode(row);
              return (
                <li key={row.polla_user_id}>
                  <button
                    type="button"
                    onClick={() => openMovements(row)}
                    className="flex w-full flex-col gap-2 rounded-md border bg-card p-3 text-left text-card-foreground transition-colors hover:bg-accent"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium">
                        {code ? `${code} · ` : ''}
                        {row.user_name}
                      </span>
                      <RowStatus row={row} />
                    </span>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {CARD_FIELDS.map(([key, label]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="tabular-nums">${fmtMoney(row[key])}</dd>
                        </div>
                      ))}
                    </dl>
                    <span className="text-right font-semibold tabular-nums">
                      Debe ${fmtMoney(row.total)}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="flex justify-between rounded-md border bg-muted px-3 py-2 text-sm font-semibold">
              <span>Total general</span>
              <span className="tabular-nums">Debe ${fmtMoney(totals.total)}</span>
            </li>
          </ul>

          <div className="hidden overflow-x-auto rounded-md border bg-card text-card-foreground md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pasador</TableHead>
                  {MONEY_COLUMNS.map(([key, label]) => (
                    <TableHead key={key} className="whitespace-nowrap text-right">
                      {label}
                    </TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const code = cashierCode(row);
                  return (
                    <TableRow
                      key={row.polla_user_id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openMovements(row)}
                      onKeyDown={(event) => event.key === 'Enter' && openMovements(row)}
                    >
                      <TableCell className="max-w-[260px] truncate">
                        {code ? `${code} · ` : ''}
                        {row.user_name}
                      </TableCell>
                      {MONEY_COLUMNS.map(([key]) => (
                        <TableCell
                          key={key}
                          className={
                            key === 'total'
                              ? 'text-right font-semibold tabular-nums'
                              : 'text-right tabular-nums'
                          }
                        >
                          ${fmtMoney(row[key])}
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap">
                        <RowStatus row={row} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell>Total general</TableCell>
                  {MONEY_COLUMNS.map(([key]) => (
                    <TableCell key={key} className="text-right tabular-nums">
                      ${fmtMoney(totals[key])}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}

      {moving && (
        <MovementsDialog
          editionId={editionId}
          userId={moving.polla_user_id}
          title={`${cashierCode(moving) ? `${cashierCode(moving)} · ` : ''}${moving.user_name}`}
          onClose={() => setMoving(null)}
        />
      )}
      {report && (
        <EditionReportDialog
          kind={report}
          edition={item}
          title={title}
          groups={groups}
          organizationId={organizationId}
          onClose={() => setReport(null)}
        />
      )}
      {generating && (
        <GenerateEditionLiquidationDialog
          item={item}
          title={title}
          rows={rows}
          cashierCode={cashierCode}
          onClose={() => setGenerating(false)}
        />
      )}
    </div>
  );
};
