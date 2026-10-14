import { ComponentProps, ReactNode, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { BarChart2, CreditCard, FileDown, FileText, List, RefreshCw, Wallet } from 'lucide-react';
import { IPollaCurrentAccountPeriodRow } from '@helper/polla/types/game.type';
import { IPollaUserOption, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
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
import { periodLabel, periodView } from '@/lib/accountPeriod';
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
import { CashierAccountView } from './CashierAccountView';
import { fetchWinnersByCashier } from './fetchers';
import { fmtMoney } from './format';
import { GenerateLiquidationDialog, LiquidateCashierDialog } from './dialogs/LiquidationDialogs';
import { ReportDialog, ReportKind } from './dialogs/ReportDialogs';

const MONEY_COLUMNS = [
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
 * liquidar por pasador o todo el día y los exportes. Cada pasador se muestra
 * acumulado desde el día siguiente a su última liquidación (en general, la
 * semana) hasta la fecha elegida.
 */
const AdminAccountView = () => {
  const { organizationId } = useAuth();

  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState('');
  const [cashier, setCashier] = useState<IPollaUserOption | null>(null);
  const [liquidating, setLiquidating] = useState<IPollaCurrentAccountPeriodRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportKind | null>(null);
  const [printing, setPrinting] = useState(false);

  const filters = {
    date,
    polla_group_id: groupId || undefined,
    polla_user_id: cashier?.polla_user_id,
    polla_organization_id: organizationId ?? undefined,
  };

  const { data, isFetching } = useCurrentAccountsOfDay(filters);
  const rows = useMemo(() => data?.data ?? [], [data]);
  // Lo que se muestra y se exporta: los montos acumulados del período.
  const views = useMemo(() => rows.map(periodView), [rows]);
  const totals = useMemo(() => computeAccountTotals(views), [views]);

  const { data: groups } = useGroups({ polla_organization_id: organizationId ?? undefined });
  const groupList = useMemo(() => groups?.data ?? [], [groups]);
  const groupById = useMemo(
    () => new Map(groupList.map((group) => [group.polla_group_id, group.name])),
    [groupList]
  );

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
        rows: views,
        groupName: groupId ? groupById.get(groupId) : undefined,
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
      <PageHeader description="Pase, aciertos, reclamos, cobros y pagos por pasador, acumulados desde su última liquidación. La liquidación no tiene deje." />

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
          disabled={rows.length === 0}
        >
          Generar liquidación
        </ActionButton>
        <Button
          type="button"
          className="gap-2 sm:col-span-2"
          onClick={() => calculate({ date, ...scope })}
          disabled={isCalculating}
        >
          <RefreshCw className={isCalculating ? 'animate-spin' : undefined} />
          {isCalculating ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="account-date">A la fecha</Label>
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
                  {group.name}
                </SelectItem>
              ))}
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

      <p className="mb-2 text-sm text-muted-foreground">
        Acumulado desde la última liquidación de cada pasador hasta el{' '}
        {dayjs(date).format('DD/MM/YYYY')}
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
                      {row.user_number ? `${row.user_number} · ` : ''}
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
                    <TableCell className="tabular-nums">{row.user_number ?? ''}</TableCell>
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
                    <TableCell>
                      {row.polla_group_id ? (groupById.get(row.polla_group_id) ?? '') : ''}
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
      {generating && (
        <GenerateLiquidationDialog
          date={date}
          rows={rows}
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

export const CurrentAccountPage = () => {
  const { role } = useAuth();
  return role === POLLA_USER_TYPE.CASHIER ? <CashierAccountView /> : <AdminAccountView />;
};

export default CurrentAccountPage;
