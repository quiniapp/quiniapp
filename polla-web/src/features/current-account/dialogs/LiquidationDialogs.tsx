import { FormEvent, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { IPollaCurrentAccountPeriodRow } from '@helper/polla/types/game.type';
import {
  useBulkUpdateCurrentAccounts,
  useLiquidateCurrentAccounts,
  useUpdateCurrentAccount,
} from '@/hooks/mutations/usePollaMutations';
import { Button } from '@/components/ui/button';
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
import { periodLabel, periodView } from '@/lib/accountPeriod';
import { DayBetsTables } from '../DayBetsTables';
import { fmtMoney } from '../format';

/** Acepta coma decimal y signo (un reclamo puede ser negativo). */
const parseAmount = (raw: string): number | null => {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
};

/** Lo que se carga a mano en la fila del día que se liquida. */
const EDITABLE = [
  ['claims', 'Reclamos del día'],
  ['bills', 'Gastos'],
  ['previous_balance', 'Saldo anterior'],
  ['collections', 'Cobro al pasador'],
  ['paid', 'Pago al pasador'],
] as const;

type EditableKey = (typeof EDITABLE)[number][0];

const ReadOnlyAmount = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">${fmtMoney(value)}</span>
  </div>
);

/**
 * Liquidar un pasador, como el modal de QuiniApp, pero por período: pase,
 * borradas, comisión, aciertos y lo que deja se acumulan desde el día
 * siguiente a su última liquidación (o en el rango elegido). Reclamos, gastos,
 * cobro y pago se cargan en el día que se liquida. Sin deje.
 */
export const LiquidateCashierDialog = ({
  account,
  onClose,
}: {
  account: IPollaCurrentAccountPeriodRow;
  onClose: () => void;
}) => {
  const view = periodView(account);
  // El saldo anterior solo se corrige si el período arranca ese día: a mitad de
  // período es el total del día anterior, que ya viene encadenado.
  const startsToday = account.period.from === account.date;
  const editable = EDITABLE.filter(([key]) => key !== 'previous_balance' || startsToday);

  const [form, setForm] = useState<Record<EditableKey, string>>(
    () =>
      Object.fromEntries(EDITABLE.map(([key]) => [key, String(Number(account[key]))])) as Record<
        EditableKey,
        string
      >
  );
  const { mutate: update, isPending } = useUpdateCurrentAccount();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const props: Record<string, number> = {};
    for (const [key, label] of editable) {
      const value = parseAmount(form[key]);
      if (value === null) {
        toast.error(`Revisá ${label.toLowerCase()}`);
        return;
      }
      props[key] = value;
    }

    update(
      { id: account.polla_current_account_id, ...props, liquidate: true },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto md:max-w-[980px]">
        <DialogHeader>
          <DialogTitle>
            Liquidar {account.user_number ? `${account.user_number} · ` : ''}
            {account.user_name} · {periodLabel(view.period_from, account.date, 'DD-MM-YYYY')}
          </DialogTitle>
          <DialogDescription>
            Pase, borradas, comisión, aciertos y lo que deja son del período. Reclamos, gastos,
            cobro y pago son del {dayjs(account.date).format('DD-MM-YYYY')}. Pase jugadas − borradas
            = pase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <ReadOnlyAmount label="Pase jugadas" value={view.bets_pass} />
              <ReadOnlyAmount label="Borradas" value={view.deleted_pass} />
              <ReadOnlyAmount label="Pase" value={view.pass} />
              <ReadOnlyAmount label="Comisión" value={view.cashier_commission} />
              <ReadOnlyAmount label="Aciertos" value={view.successes} />
              <ReadOnlyAmount label="Reclamos del período" value={view.claims} />
              <ReadOnlyAmount label="Deja" value={view.revenue} />
              {!startsToday && (
                <ReadOnlyAmount label="Saldo anterior" value={view.previous_balance} />
              )}
              <ReadOnlyAmount label="Total" value={view.total} />
            </div>
            <div className="flex flex-col gap-2">
              {editable.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label htmlFor={`liquidate-${key}`} className="shrink-0">
                    {label}
                  </Label>
                  <Input
                    id={`liquidate-${key}`}
                    inputMode="decimal"
                    className="w-36 text-right tabular-nums"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <DayBetsTables
            from={view.period_from}
            to={account.date}
            cashierId={account.polla_user_id}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Liquidando…' : 'Generar liquidación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const BULK_LABEL = { claims: 'Reclamos', collections: 'Cobros', paid: 'Pagos' } as const;

type BulkKey = keyof typeof BULK_LABEL;

/**
 * Generar las liquidaciones de todos los pasadores en el día (como QuiniApp):
 * cada uno con lo acumulado en su período, o en el rango que arranca en
 * `from`. Reclamos, cobros y pagos se corrigen en la grilla (son del día), se
 * guardan y todos los períodos quedan cerrados en esa fecha.
 */
export const GenerateLiquidationDialog = ({
  date,
  from,
  rows,
  organizationId,
  onClose,
}: {
  date: string;
  /** Liquidación por rango: primer día del rango. */
  from?: string;
  rows: IPollaCurrentAccountPeriodRow[];
  organizationId: string | null;
  onClose: () => void;
}) => {
  const [edits, setEdits] = useState<Record<string, Partial<Record<BulkKey, string>>>>({});
  const { mutateAsync: bulkUpdate, isPending: isSaving } = useBulkUpdateCurrentAccounts();
  const { mutateAsync: liquidate, isPending: isLiquidating } = useLiquidateCurrentAccounts();

  const valueOf = (row: IPollaCurrentAccountPeriodRow, key: BulkKey) =>
    edits[row.polla_current_account_id]?.[key] ?? String(Number(row[key]));

  const editCell = (row: IPollaCurrentAccountPeriodRow, key: BulkKey) => (
    <TableCell>
      <Input
        aria-label={`${BULK_LABEL[key]} de ${row.user_name}`}
        inputMode="decimal"
        className="h-8 w-24 text-right tabular-nums"
        value={valueOf(row, key)}
        onChange={(e) =>
          setEdits({
            ...edits,
            [row.polla_current_account_id]: {
              ...edits[row.polla_current_account_id],
              [key]: e.target.value,
            },
          })
        }
      />
    </TableCell>
  );

  const handleGenerate = async () => {
    const updates: { polla_current_account_id: string; props: Record<string, number> }[] = [];

    for (const [id, changes] of Object.entries(edits)) {
      const props: Record<string, number> = {};
      for (const [key, raw] of Object.entries(changes)) {
        const value = parseAmount(raw ?? '');
        if (value === null) {
          toast.error('Hay un monto inválido en la grilla');
          return;
        }
        props[key] = value;
      }
      if (Object.keys(props).length) updates.push({ polla_current_account_id: id, props });
    }

    const scope = organizationId ? { polla_organization_id: organizationId } : {};

    try {
      if (updates.length) await bulkUpdate({ date, updates, ...scope });
      await liquidate({ date, range_from: from, ...scope });
      onClose();
    } catch {
      // El hook ya avisó el error.
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto lg:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>
            Generar liquidaciones{' '}
            {from
              ? `del ${periodLabel(from, date, 'DD-MM-YYYY')}`
              : `al ${dayjs(date).format('DD-MM-YYYY')}`}
          </DialogTitle>
          <DialogDescription>
            {from
              ? 'Cada pasador con lo de esos días.'
              : 'Cada pasador con lo acumulado desde su última liquidación.'}{' '}
            Corregí reclamos, cobros y pagos del día; al generar, todos los períodos quedan
            liquidados el {dayjs(date).format('DD-MM-YYYY')}.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="whitespace-nowrap text-right">Pase jugadas</TableHead>
                <TableHead className="text-right">Borradas</TableHead>
                <TableHead className="text-right">Pase</TableHead>
                <TableHead className="text-right">Aciertos</TableHead>
                <TableHead className="text-right">Reclamos del día</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">Cobros</TableHead>
                <TableHead className="text-right">Pagos</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const view = periodView(row);
                return (
                  <TableRow key={row.polla_current_account_id}>
                    <TableCell>{row.user_number ?? ''}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{row.user_name}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {dayjs(view.period_from).format('DD/MM')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(view.bets_pass)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(view.deleted_pass)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(view.pass)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(view.successes)}
                    </TableCell>
                    {editCell(row, 'claims')}
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(view.subtotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(view.previous_balance)}
                    </TableCell>
                    {editCell(row, 'collections')}
                    {editCell(row, 'paid')}
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${fmtMoney(view.total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isSaving || isLiquidating || rows.length === 0}
          >
            {isSaving || isLiquidating ? 'Generando…' : 'Generar liquidación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
