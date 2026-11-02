import { FormEvent, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Printer, Wallet } from 'lucide-react';
import {
  IPollaGroupAccountEntityFront,
  IPollaGroupAccountPreview,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useGroupAccountPreviews, useGroupAccounts } from '@/hooks/fetchs/usePollaData';
import { useLiquidateGroup } from '@/hooks/mutations/usePollaMutations';
import { flattenPages } from '@/hooks/useApi';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { printGroupLiquidationTicket } from '@/functions/current-account/groupLiquidationTicket';
import { todayIso } from '@/lib/dates';
import { fetchOrganizationName } from './fetchers';
import { fmtMoney } from './format';

/** Acepta coma decimal y signo (un ajuste puede ser negativo). */
const parseAmount = (raw: string): number | null => {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
};

const fmtDay = (value: string | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');

/** Comisión del admin: solo si la base (con el arrastre) da positiva. */
const commissionOf = (dragBase: number, percentage: number) =>
  dragBase > 0 ? Math.round(dragBase * percentage) / 100 : 0;

const Amount = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>
      ${fmtMoney(value)}
    </span>
  </div>
);

/**
 * Liquidar un grupo a la fecha: lo que dejaron sus pasadores en el período,
 * menos los gastos del grupo, con el arrastre que venía. El % del admin se
 * escribe acá; con base negativa no hay comisión y se arrastra.
 */
const LiquidateGroupDialog = ({
  preview,
  onClose,
}: {
  preview: IPollaGroupAccountPreview;
  onClose: () => void;
}) => {
  const { organizationId } = useAuth();
  const [percentage, setPercentage] = useState('');
  const [adjustments, setAdjustments] = useState('0');
  const [paid, setPaid] = useState('0');
  const { mutate: liquidate, isPending } = useLiquidateGroup();

  const pct = parseAmount(percentage) ?? 0;
  const dragBase = Number(preview.drag_base);
  const commission = commissionOf(dragBase, pct);
  const total =
    Number(preview.previous_balance) +
    commission +
    (parseAmount(adjustments) ?? 0) -
    (parseAmount(paid) ?? 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const values = {
      admin_percentage: parseAmount(percentage),
      adjustments: parseAmount(adjustments),
      paid: parseAmount(paid),
    };

    if (
      values.admin_percentage === null ||
      values.admin_percentage < 0 ||
      values.admin_percentage > 100
    ) {
      toast.error('Poné el porcentaje del admin (0 a 100)');
      return;
    }
    if (values.adjustments === null || values.paid === null || values.paid < 0) {
      toast.error('Revisá ajustes y pago');
      return;
    }

    liquidate(
      {
        polla_group_id: preview.polla_group_id,
        date: preview.date,
        admin_percentage: values.admin_percentage,
        adjustments: values.adjustments,
        paid: values.paid,
      },
      {
        onSuccess: async (account) => {
          onClose();
          try {
            await printGroupLiquidationTicket({
              account,
              orgName: await fetchOrganizationName(organizationId),
            });
          } catch {
            toast.error('No se pudo imprimir el ticket');
          }
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            Liquidar {preview.group_name} · {fmtDay(preview.period_from)} al {fmtDay(preview.date)}
          </DialogTitle>
          <DialogDescription>
            Con todos sus pasadores ya liquidados. El total es lo que la organización le debe al
            admin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Amount label="Deja pasadores" value={Number(preview.cashiers_subtotal)} />
            <Amount label="Gastos del grupo" value={-Number(preview.expenses)} />
            <Amount label="Arrastre anterior" value={Number(preview.previous_drag)} />
            <Amount label="Base" value={dragBase} strong />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="group-liquidate-percentage">% del admin</Label>
              <Input
                id="group-liquidate-percentage"
                inputMode="decimal"
                autoFocus
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="group-liquidate-adjustments">Ajustes</Label>
              <Input
                id="group-liquidate-adjustments"
                inputMode="decimal"
                value={adjustments}
                onChange={(e) => setAdjustments(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="group-liquidate-paid">Pagado al admin</Label>
              <Input
                id="group-liquidate-paid"
                inputMode="decimal"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Amount label="Comisión del admin" value={commission} />
            <Amount label="Arrastra" value={dragBase > 0 ? 0 : dragBase} />
            <Amount label="Saldo anterior" value={Number(preview.previous_balance)} />
            <Amount label="Total admin" value={total} strong />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Liquidando…' : 'Liquidar e imprimir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** Historial de liquidaciones de grupos (el admin ve solo las del suyo). */
const GroupAccountHistory = ({ groupId }: { groupId?: string }) => {
  const { organizationId } = useAuth();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useGroupAccounts({
    polla_group_id: groupId,
  });
  const { rows, totalCount } = flattenPages(data?.pages);

  const reprint = async (account: IPollaGroupAccountEntityFront) => {
    try {
      await printGroupLiquidationTicket({
        account,
        orgName: await fetchOrganizationName(organizationId),
      });
    } catch {
      toast.error('No se pudo imprimir el ticket');
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState message={isFetching ? 'Cargando…' : 'Todavía no hay liquidaciones de grupo'} />
    );
  }

  return (
    <InfiniteList
      totalCount={totalCount}
      loadedCount={rows.length}
      hasNextPage={Boolean(hasNextPage)}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
    >
      <div className="overflow-x-auto rounded-md border bg-card text-card-foreground">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Deja pasadores</TableHead>
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">% admin</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead className="text-right">Arrastra</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Total admin</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((account) => (
              <TableRow key={account.polla_group_account_id}>
                <TableCell className="font-medium">{account.group_name}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {dayjs(account.period_from).format('DD/MM')} al{' '}
                  {dayjs(account.date).format('DD/MM/YYYY')}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.cashiers_subtotal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.expenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.drag_base)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(account.admin_percentage)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.admin_commission)}
                </TableCell>
                <TableCell className="text-right tabular-nums">${fmtMoney(account.drag)}</TableCell>
                <TableCell className="text-right tabular-nums">${fmtMoney(account.paid)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  ${fmtMoney(account.total)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Imprimir"
                    aria-label={`Imprimir la liquidación de ${account.group_name}`}
                    onClick={() => reprint(account)}
                  >
                    <Printer />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </InfiniteList>
  );
};

/**
 * Lo que se liquidaría a cada grupo a la fecha. Se liquida cuando todos sus
 * pasadores están liquidados hasta ese día.
 */
const GroupPreviews = ({ date, canLiquidate }: { date: string; canLiquidate: boolean }) => {
  const { data: previews = [], isFetching } = useGroupAccountPreviews(date);
  const [liquidating, setLiquidating] = useState<IPollaGroupAccountPreview | null>(null);

  if (previews.length === 0) {
    return <EmptyState message={isFetching ? 'Cargando…' : 'No hay grupos'} />;
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {previews.map((preview) => {
          const pending = preview.pending_cashiers;
          // Sin nada que liquidar (ni arrastre que mover) no se genera una fila vacía.
          const empty =
            Number(preview.cashiers_subtotal) === 0 &&
            Number(preview.expenses) === 0 &&
            Number(preview.previous_drag) === 0;
          const blocked = pending.length > 0 || Boolean(preview.later_liquidation_date) || empty;
          return (
            <li
              key={preview.polla_group_id}
              className="flex flex-col gap-2 rounded-md border bg-card p-3 text-card-foreground"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{preview.group_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {fmtDay(preview.period_from)} ·{' '}
                    {preview.last_liquidation_date
                      ? `liquidación anterior ${fmtDay(preview.last_liquidation_date)}`
                      : 'primera liquidación'}
                  </p>
                  {preview.liquidated_on_date && (
                    <Badge variant="success" className="mt-1">
                      Liquidado el {fmtDay(preview.date)}
                    </Badge>
                  )}
                </div>
                {canLiquidate && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={blocked}
                    onClick={() => setLiquidating(preview)}
                  >
                    <Wallet />
                    {preview.liquidated_on_date ? 'Rehacer' : 'Liquidar'}
                  </Button>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Deja pasadores</dt>
                <dd className="text-right tabular-nums">${fmtMoney(preview.cashiers_subtotal)}</dd>
                <dt className="text-muted-foreground">Gastos del grupo</dt>
                <dd className="text-right tabular-nums">${fmtMoney(preview.expenses)}</dd>
                <dt className="text-muted-foreground">Arrastre anterior</dt>
                <dd className="text-right tabular-nums">${fmtMoney(preview.previous_drag)}</dd>
                <dt className="font-medium">Base</dt>
                <dd className="text-right font-semibold tabular-nums">
                  ${fmtMoney(preview.drag_base)}
                </dd>
                <dt className="text-muted-foreground">Saldo del admin</dt>
                <dd className="text-right tabular-nums">${fmtMoney(preview.previous_balance)}</dd>
              </dl>

              {preview.later_liquidation_date && (
                <p className="text-xs text-muted-foreground">
                  Ya se liquidó el {fmtDay(preview.later_liquidation_date)}.
                </p>
              )}
              {empty && !preview.liquidated_on_date && (
                <p className="text-xs text-muted-foreground">Sin movimientos en el período.</p>
              )}
              {pending.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Falta liquidar:</span>
                  {pending.map((cashier) => (
                    <Badge key={cashier.polla_user_id} variant="outline">
                      {cashier.number ? `${cashier.number} · ` : ''}
                      {cashier.name}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {liquidating && (
        <LiquidateGroupDialog preview={liquidating} onClose={() => setLiquidating(null)} />
      )}
    </>
  );
};

/** Pestaña "Grupos" de la cuenta corriente (superadmin+). */
export const GroupAccountsPanel = () => {
  const [date, setDate] = useState(todayIso());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:w-[200px]">
          <Label htmlFor="group-account-date">A la fecha</Label>
          <DateInput
            id="group-account-date"
            value={date}
            max={todayIso()}
            onValueChange={setDate}
          />
        </div>
        <GroupPreviews date={date} canLiquidate />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Liquidaciones</h2>
        <GroupAccountHistory />
      </div>
    </div>
  );
};

/** La cuenta del grupo para su admin: lo que va acumulando y sus liquidaciones. */
export const GroupAccountView = () => {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader description="La cuenta de tu grupo: lo que dejan tus pasadores, tu comisión y lo que se te pagó. La liquida el superadministrador." />
      <GroupPreviews date={todayIso()} canLiquidate={false} />
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Liquidaciones</h2>
        <GroupAccountHistory groupId={user?.polla_group_id ?? undefined} />
      </div>
    </div>
  );
};
