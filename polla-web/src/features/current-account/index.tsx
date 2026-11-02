import { ComponentProps, ReactNode, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { BarChart2, CreditCard, FileDown, FileText, List, RefreshCw, Wallet } from 'lucide-react';
import {
  IPollaCurrentAccountPeriodRow,
  POLLA_LIQUIDATION_NO_GROUP,
} from '@helper/polla/types/game.type';
import { IPollaUserOption, POLLA_USER_TYPE, pollaCashierCode } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useCurrentAccountsOfDay } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import { useCalculateCurrentAccounts } from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { UserSearchPicker } from '@/components/UserSearchPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { todayIso } from '@/lib/dates';
import { accountRangeFrom, oldestRangeFrom, periodLabel, periodView } from '@/lib/accountPeriod';
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
import { downloadDailyAccountsPDF } from '@/functions/current-account/accountTablePDF';
import { downloadLiquidationSlipsPDF } from '@/functions/current-account/liquidationSlipPDF';
import { computeAccountTotals } from '@/functions/current-account/pdf-shared';
import { cn } from '@/lib/utils';
import { groupLabel } from '@/lib/pollaGroups';
import { CashierAccountView } from './CashierAccountView';
import { GroupAccountView, GroupAccountsPanel } from './GroupAccounts';
import { fetchWinnersByCashier } from './fetchers';
import { ReportMode, fmtMoney } from './format';
import { GenerateLiquidationDialog, LiquidateCashierDialog } from './dialogs/LiquidationDialogs';
import { ReportDialog, ReportKind } from './dialogs/ReportDialogs';
import { ModeToggle } from './dialogs/shared';

/** Pase jugadas − Borradas = Pase (más los reclamos positivos), base de la comisión. */
const MONEY_COLUMNS = [
  ['bets_pass', 'Pase jugadas'],
  ['deleted_pass', 'Borradas'],
  ['pass', 'Pase'],
  ['successes', 'Aciertos'],
  ['claims', 'Reclamos'],
  ['subtotal', 'Subtotal'],
  ['previous_balance', 'Saldo anterior'],
  ['collections', 'Cobros'],
  ['paid', 'Pagos'],
  ['total', 'Total'],
] as const;

const ActionButton = ({
  icon,
  children,
  ...props
}: { icon: ReactNode; children: ReactNode } & ComponentProps<typeof Button>) => (
  <Button type="button" variant="outline" className="justify-start gap-2" {...props}>
    {icon}
    {children}
  </Button>
);

/**
 * Cuenta corriente de los pasadores, como la de QuiniApp sin Arrastre ni Deje
 * (la liquidación de Polla no tiene deje): filtros, planilla con total general,
 * liquidar por pasador o un grupo entero en el día, y los exportes. Se ven
 * todos los pasadores (como `{grupo}-{número}`: el número se repite entre
 * grupos), pero "Generar liquidación" es de un grupo por vez. Por día, cada
 * pasador se muestra acumulado desde el día siguiente a su última liquidación
 * (en general, la semana) hasta la fecha elegida; por rango, lo de esos días.
 * En los dos casos se liquida en la última fecha.
 */
const AdminAccountView = () => {
  const { organizationId } = useAuth();

  const [mode, setMode] = useState<ReportMode>('day');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [from, setFrom] = useState(dayjs().startOf('week').format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState('');
  const [cashier, setCashier] = useState<IPollaUserOption | null>(null);
  const [liquidating, setLiquidating] = useState<IPollaCurrentAccountPeriodRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportKind | null>(null);
  const [printing, setPrinting] = useState(false);

  const rangeFrom = mode === 'range' ? accountRangeFrom(from, date) : undefined;

  // "Sin grupo" no es un filtro de la API: se acota acá abajo.
  const noGroup = groupId === POLLA_LIQUIDATION_NO_GROUP;

  const filters = {
    date,
    range_from: rangeFrom,
    polla_group_id: groupId && !noGroup ? groupId : undefined,
    polla_user_id: cashier?.polla_user_id,
    polla_organization_id: organizationId ?? undefined,
  };

  const { data, isFetching } = useCurrentAccountsOfDay(filters);
  const rows = useMemo(
    () => (data?.data ?? []).filter((row) => !noGroup || !row.polla_group_id),
    [data, noGroup]
  );
  // Lo que se muestra y se exporta: los montos acumulados del período.
  const views = useMemo(() => rows.map(periodView), [rows]);
  const totals = useMemo(() => computeAccountTotals(views), [views]);

  const { data: groups } = useGroups({ polla_organization_id: organizationId ?? undefined });
  const groupList = useMemo(() => groups?.data ?? [], [groups]);
  const groupById = useMemo(
    () => new Map(groupList.map((group) => [group.polla_group_id, group])),
    [groupList]
  );
  type AccountRow = Pick<IPollaCurrentAccountPeriodRow, 'polla_group_id' | 'user_number'>;
  const groupOf = (row: AccountRow) =>
    row.polla_group_id ? groupById.get(row.polla_group_id) : undefined;
  /** `2-5`: el número de pasador se repite entre grupos. */
  const cashierCode = (row: AccountRow) => pollaCashierCode(groupOf(row)?.number, row.user_number);

  // Grupo que se liquida con "Generar liquidación" (uno por vez).
  const selectedGroup = noGroup ? null : groupById.get(groupId);
  const liquidationGroup = groupId
    ? {
        id: groupId,
        number: selectedGroup?.number ?? null,
        label: noGroup ? 'Sin grupo' : groupLabel(selectedGroup),
      }
    : null;

  const { mutate: calculate, isPending: isCalculating } = useCalculateCurrentAccounts();

  const scope = organizationId ? { polla_organization_id: organizationId } : {};

  const handleExportDaily = async () => {
    if (!rows.length) {
      toast.error('No hay datos para exportar');
      return;
    }
    setPrinting(true);
    try {
      await downloadDailyAccountsPDF({
        date,
        from: rangeFrom,
        rows: views,
        groupName: groupId ? (noGroup ? 'Sin grupo' : groupById.get(groupId)?.name) : undefined,
      });
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setPrinting(false);
    }
  };

  const handleExportLiquidations = async () => {
    if (!rows.length) {
      toast.error('No hay cuentas para liquidar');
      return;
    }
    setPrinting(true);
    try {
      const winnersByCashier = await fetchWinnersByCashier({
        accounts: views,
        date,
        organizationId,
      });
      await downloadLiquidationSlipsPDF({ accounts: views, winnersByCashier });
    } catch {
      toast.error('No se pudieron exportar las liquidaciones');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div>
      <PageHeader description="Pase, borradas, aciertos, reclamos, cobros y pagos por pasador, acumulados desde su última liquidación o en un rango de fechas. La liquidación no tiene deje." />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ActionButton icon={<FileText />} onClick={handleExportDaily} disabled={printing}>
          Exportar diario
        </ActionButton>
        <ActionButton icon={<FileDown />} onClick={handleExportLiquidations} disabled={printing}>
          Exportar liquidación
        </ActionButton>
        <ActionButton icon={<CreditCard />} onClick={() => setReport('collections')}>
          Exportar cobros y pagos
        </ActionButton>
        <ActionButton icon={<BarChart2 />} onClick={() => setReport('summary')}>
          Resumen cuenta corriente
        </ActionButton>
        <ActionButton icon={<List />} onClick={() => setReport('subtotals')}>
          Exportar subtotales
        </ActionButton>
        <ActionButton
          icon={<Wallet />}
          onClick={() => setGenerating(true)}
          disabled={rows.length === 0 || !liquidationGroup}
          title={liquidationGroup ? undefined : 'Elegí un grupo para liquidarlo'}
        >
          Generar liquidación
        </ActionButton>
        <Button
          type="button"
          className="gap-2 sm:col-span-2"
          onClick={() => calculate({ date, range_from: rangeFrom, ...scope })}
          disabled={isCalculating}
        >
          <RefreshCw className={isCalculating ? 'animate-spin' : undefined} />
          {isCalculating ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <ModeToggle id="account-mode" label="Liquidar" value={mode} onChange={setMode} />

        {mode === 'range' && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="account-from">Desde</Label>
            <DateInput
              id="account-from"
              value={rangeFrom ?? from}
              min={oldestRangeFrom(date)}
              max={date}
              onValueChange={setFrom}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="account-date">{mode === 'range' ? 'Hasta' : 'A la fecha'}</Label>
          <DateInput id="account-date" value={date} max={todayIso()} onValueChange={setDate} />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Label>Grupo</Label>
          <Select value={groupId || 'all'} onValueChange={(v) => setGroupId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {groupList.map((group) => (
                <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
                  {groupLabel(group)}
                </SelectItem>
              ))}
              <SelectItem value={POLLA_LIQUIDATION_NO_GROUP}>Sin grupo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <UserSearchPicker
          id="account-cashier"
          label="Pasador"
          userTypes={[POLLA_USER_TYPE.CASHIER]}
          value={cashier}
          onChange={setCashier}
          placeholder="Todos: número o nombre"
          clearLabel="Todos"
          className="sm:w-[260px]"
        />
      </div>

      {!liquidationGroup && rows.length > 0 && (
        <p className="mb-2 text-sm text-muted-foreground">
          Para generar la liquidación elegí un grupo: se liquida un grupo por vez.
        </p>
      )}

      <p className="mb-2 text-sm text-muted-foreground">
        {rangeFrom
          ? `Del ${dayjs(rangeFrom).format('DD/MM/YYYY')} al ${dayjs(date).format('DD/MM/YYYY')}: se liquida el ${dayjs(date).format('DD/MM/YYYY')}`
          : `Acumulado desde la última liquidación de cada pasador hasta el ${dayjs(date).format('DD/MM/YYYY')}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          message={
            isFetching
              ? 'Cargando…'
              : 'No hay movimientos para esa fecha. Tocá Actualizar para calcularla.'
          }
        />
      ) : (
        <>
          {/* Mobile: tarjetas. La planilla tiene 12 columnas. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {views.map((row, index) => (
              <li key={row.polla_current_account_id} className="rounded-md border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {cashierCode(row) ? `${cashierCode(row)} · ` : ''}
                      {row.user_name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {periodLabel(row.period_from, row.date)}
                    </span>
                  </span>
                  {row.is_liquidated && <Badge variant="success">Liquidado</Badge>}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {MONEY_COLUMNS.map(([key, label]) => (
                    <div key={key} className="contents">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right tabular-nums">${fmtMoney(row[key])}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setLiquidating(rows[index])}
                >
                  Liquidar
                </Button>
              </li>
            ))}
            <li className="rounded-md border-2 bg-card p-3">
              <p className="mb-1 font-semibold">Total general</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {MONEY_COLUMNS.map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      ${fmtMoney(totals[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          </ul>

          <div className="hidden overflow-x-auto rounded-md border bg-card text-card-foreground md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Liquidar</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Desde</TableHead>
                  {MONEY_COLUMNS.map(([key, label]) => (
                    <TableHead key={key} className="whitespace-nowrap text-right">
                      {label}
                    </TableHead>
                  ))}
                  <TableHead>Grupo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {views.map((row, index) => (
                  <TableRow key={row.polla_current_account_id}>
                    <TableCell>
                      <Button
                        type="button"
                        variant={row.is_liquidated ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => setLiquidating(rows[index])}
                      >
                        {row.is_liquidated ? 'Liquidado' : 'Liquidar'}
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {cashierCode(row)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{row.user_name}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {dayjs(row.period_from).format('DD/MM')}
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
                      {groupOf(row) ? groupLabel(groupOf(row)) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={4}>Total general</TableCell>
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

      {liquidating && (
        <LiquidateCashierDialog account={liquidating} onClose={() => setLiquidating(null)} />
      )}
      {generating && liquidationGroup && (
        <GenerateLiquidationDialog
          date={date}
          from={rangeFrom}
          rows={rows}
          group={liquidationGroup}
          organizationId={organizationId}
          onClose={() => setGenerating(false)}
        />
      )}
      {report && (
        <ReportDialog
          kind={report}
          initialDate={date}
          initialGroupId={groupId}
          groups={groupList}
          organizationId={organizationId}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  );
};

type AccountTab = 'cashiers' | 'groups';

const ACCOUNT_TABS: { value: AccountTab; label: string }[] = [
  { value: 'cashiers', label: 'Pasadores' },
  { value: 'groups', label: 'Grupos' },
];

/**
 * Superadmin+ liquida a cada pasador y, con los de un grupo liquidados, al
 * grupo (comisión del admin). El admin ve solo la cuenta de su grupo; el
 * pasador, la suya.
 */
export const CurrentAccountPage = () => {
  const { role } = useAuth();
  const [tab, setTab] = useState<AccountTab>('cashiers');

  if (role === POLLA_USER_TYPE.CASHIER) return <CashierAccountView />;
  if (role === POLLA_USER_TYPE.ADMIN) return <GroupAccountView />;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Cuenta corriente"
        className="inline-flex w-fit rounded-md border bg-card p-1"
      >
        {ACCOUNT_TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tab === item.value
                ? 'bg-nav-active text-nav-active-foreground'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'cashiers' ? <AdminAccountView /> : <GroupAccountsPanel />}
    </div>
  );
};

export default CurrentAccountPage;
