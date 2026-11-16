import { ComponentProps, ReactNode, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { BarChart2, CreditCard, FileDown, FileText, List, Pencil } from 'lucide-react';
import {
  IPollaCurrentAccountPeriodRow,
  POLLA_LIQUIDATION_NO_GROUP,
} from '@helper/polla/types/game.type';
import {
  IPollaUserOption,
  POLLA_ACCOUNT_ROLES,
  POLLA_USER_TYPE,
  pollaCashierCode,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useCurrentAccountsOfDay } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { UserSearchPicker } from '@/components/UserSearchPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { todayIso } from '@/lib/dates';
import {
  AccountPeriodView,
  accountRangeFrom,
  oldestRangeFrom,
  periodLabel,
  periodView,
} from '@/lib/accountPeriod';
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
import { exportLiquidationSlipsZip } from '@/functions/current-account/liquidationSlipPDF';
import { liquidationZipName } from '@/lib/liquidationZip';
import { computeAccountTotals } from '@/functions/current-account/pdf-shared';
import { groupLabel } from '@/lib/pollaGroups';
import { ReportMode, fmtMoney } from '../format';
import { ReportDialog, ReportKind } from '../dialogs/ReportDialogs';
import { ExportLiquidationsDialog } from '../dialogs/ExportLiquidationsDialog';
import { ModeToggle } from '../dialogs/shared';
import { GroupAccountHistory } from '../GroupAccounts';
import { EditDayPaymentsDialog } from './EditDayPaymentsDialog';

/** Pase jugadas − Borradas = Pase (más los reclamos positivos), base de la comisión. */
const MONEY_COLUMNS = [
  ['bets_pass', 'Pase jugadas'],
  ['deleted_pass', 'Borradas'],
  ['pass', 'Pase'],
  // Los premios no van en la cuenta corriente (R18): están en Premios.
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
 * Historial por fechas: lo liquidado por días antes del cambio a liquidar por
 * edición. Filtros, planilla con total general y los exportes por fecha;
 * debajo, el historial de liquidaciones de grupos. Por día, cada pasador se
 * muestra acumulado desde el día siguiente a su última liquidación hasta la
 * fecha elegida; por rango, lo de esos días. Lo único que se edita son los
 * cobros y pagos de un día (modo un día, `POLLA_ACCOUNT_ROLES`).
 */
export const DailyHistoryView = () => {
  const { organizationId, role } = useAuth();

  const [mode, setMode] = useState<ReportMode>('day');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [from, setFrom] = useState(dayjs().startOf('week').format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState('');
  const [cashier, setCashier] = useState<IPollaUserOption | null>(null);
  const [report, setReport] = useState<ReportKind | null>(null);
  const [printing, setPrinting] = useState(false);
  const [exportingSlips, setExportingSlips] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rangeFrom = mode === 'range' ? accountRangeFrom(from, date) : undefined;
  // Por rango las filas son acumulados: se edita solo en modo un día.
  const canEdit = mode === 'day' && Boolean(role && POLLA_ACCOUNT_ROLES.includes(role));

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
  // El diálogo recibe la fila cruda (montos del día), nunca la del período.
  const editingRow = editingId
    ? rows.find((row) => row.polla_current_account_id === editingId)
    : undefined;

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

  const editButton = (row: AccountPeriodView) => (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={`Editar cobros y pagos de ${row.user_name}`}
      onClick={() => setEditingId(row.polla_current_account_id)}
    >
      <Pencil />
      Editar
    </Button>
  );

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

  // "Exportar liquidación" abre la lista para elegir qué pasadores exportar.
  const handleOpenExportLiquidations = () => {
    if (!rows.length) {
      toast.error('No hay cuentas para liquidar');
      return;
    }
    setExportingSlips(true);
  };

  const handleExportLiquidations = async (accounts: AccountPeriodView[]) => {
    setPrinting(true);
    try {
      const selectedGroup = groupId ? groupById.get(groupId) : undefined;
      await exportLiquidationSlipsZip({
        sheets: accounts.map((account) => ({
          account,
          cashierCode: cashierCode(account),
          group: groupOf(account),
        })),
        zipName: liquidationZipName(
          rangeFrom ? { kind: 'range', from: rangeFrom, to: date } : { kind: 'day', date },
          noGroup ? 'none' : selectedGroup ? { number: selectedGroup.number } : undefined
        ),
      });
      setExportingSlips(false);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron exportar las liquidaciones');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div>
      <PageHeader description="Liquidaciones por días anteriores al cambio. Desde ahora se liquida por edición." />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ActionButton icon={<FileText />} onClick={handleExportDaily} disabled={printing}>
          Exportar diario
        </ActionButton>
        <ActionButton
          icon={<FileDown />}
          onClick={handleOpenExportLiquidations}
          disabled={printing}
        >
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
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <ModeToggle id="account-mode" label="Ver" value={mode} onChange={setMode} />

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

      <p className="mb-2 text-sm text-muted-foreground">
        {rangeFrom
          ? `Del ${dayjs(rangeFrom).format('DD/MM/YYYY')} al ${dayjs(date).format('DD/MM/YYYY')}`
          : `Acumulado desde la última liquidación de cada pasador hasta el ${dayjs(date).format('DD/MM/YYYY')}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState message={isFetching ? 'Cargando…' : 'No hay movimientos para esa fecha.'} />
      ) : (
        <>
          {/* Mobile: tarjetas. La planilla tiene 12 columnas. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {views.map((row) => (
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
                  <span className="flex shrink-0 items-center gap-1">
                    {row.is_liquidated && <Badge variant="success">Liquidado</Badge>}
                    {canEdit && editButton(row)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {MONEY_COLUMNS.map(([key, label]) => (
                    <div key={key} className="contents">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right tabular-nums">${fmtMoney(row[key])}</dd>
                    </div>
                  ))}
                </dl>
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
                  <TableHead>Estado</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Desde</TableHead>
                  {MONEY_COLUMNS.map(([key, label]) => (
                    <TableHead key={key} className="whitespace-nowrap text-right">
                      {label}
                    </TableHead>
                  ))}
                  <TableHead>Grupo</TableHead>
                  {canEdit && (
                    <TableHead>
                      <span className="sr-only">Editar</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {views.map((row) => (
                  <TableRow key={row.polla_current_account_id}>
                    <TableCell>
                      {row.is_liquidated && <Badge variant="success">Liquidado</Badge>}
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
                    {canEdit && <TableCell className="text-right">{editButton(row)}</TableCell>}
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
                  {canEdit && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}

      {exportingSlips && (
        <ExportLiquidationsDialog
          accounts={views}
          cashierCodeOf={cashierCode}
          exporting={printing}
          onExport={handleExportLiquidations}
          onClose={() => setExportingSlips(false)}
        />
      )}
      {canEdit && editingRow && (
        <EditDayPaymentsDialog
          row={editingRow}
          title={`${cashierCode(editingRow) ? `${cashierCode(editingRow)} · ` : ''}${editingRow.user_name}`}
          onClose={() => setEditingId(null)}
        />
      )}
      <div className="mt-8 flex flex-col gap-2">
        <h2 className="font-medium">Liquidaciones de grupos por fecha</h2>
        <GroupAccountHistory />
      </div>

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
