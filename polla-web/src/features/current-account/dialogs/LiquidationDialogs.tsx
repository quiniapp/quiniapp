import { FormEvent, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { IPollaCurrentAccountEntityFront } from '@helper/polla/types/game.type';
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
import { DayBetsTables } from '../DayBetsTables';
import { fmtMoney } from '../format';

/** Acepta coma decimal y signo (un reclamo puede ser negativo). */
const parseAmount = (raw: string): number | null => {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
};

const EDITABLE = [
  ['claims', 'Reclamos'],
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
 * Liquidar un pasador en el día, como el modal de QuiniApp: se cargan
 * reclamos, gastos, saldo anterior, cobro y pago; pase, comisión, aciertos y
 * lo que deja salen de las jugadas. Sin deje.
 */
export const LiquidateCashierDialog = ({
  account,
  onClose,
}: {
  account: IPollaCurrentAccountEntityFront;
  onClose: () => void;
}) => {
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
    for (const [key, label] of EDITABLE) {
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
            {account.user_name} del {dayjs(account.date).format('DD-MM-YYYY')}
          </DialogTitle>
          <DialogDescription>
            Pase, comisión, aciertos y lo que deja salen de las jugadas del día.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <ReadOnlyAmount label="Pase" value={account.pass} />
              <ReadOnlyAmount label="Comisión" value={account.cashier_commission} />
              <ReadOnlyAmount label="Aciertos" value={account.successes} />
              <ReadOnlyAmount label="Deja" value={account.revenue} />
              <ReadOnlyAmount label="Total" value={account.total} />
            </div>
            <div className="flex flex-col gap-2">
              {EDITABLE.map(([key, label]) => (
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

          <DayBetsTables date={account.date} cashierId={account.polla_user_id} />

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
 * Generar las liquidaciones del día de todos los pasadores (como QuiniApp): se
 * corrigen reclamos, cobros y pagos en la grilla, se guardan y el día queda
 * liquidado.
 */
export const GenerateLiquidationDialog = ({
  date,
  rows,
  organizationId,
  onClose,
}: {
  date: string;
  rows: IPollaCurrentAccountEntityFront[];
  organizationId: string | null;
  onClose: () => void;
}) => {
  const [edits, setEdits] = useState<Record<string, Partial<Record<BulkKey, string>>>>({});
  const { mutateAsync: bulkUpdate, isPending: isSaving } = useBulkUpdateCurrentAccounts();
  const { mutateAsync: liquidate, isPending: isLiquidating } = useLiquidateCurrentAccounts();

  const valueOf = (row: IPollaCurrentAccountEntityFront, key: BulkKey) =>
    edits[row.polla_current_account_id]?.[key] ?? String(Number(row[key]));

  const editCell = (row: IPollaCurrentAccountEntityFront, key: BulkKey) => (
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
      await liquidate({ date, ...scope });
      onClose();
    } catch {
      // El hook ya avisó el error.
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto lg:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>Generar liquidaciones del {dayjs(date).format('DD-MM-YYYY')}</DialogTitle>
          <DialogDescription>
            Corregí reclamos, cobros y pagos; al generar, el día queda liquidado para todos los
            pasadores.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Pase</TableHead>
                <TableHead className="text-right">Aciertos</TableHead>
                <TableHead className="text-right">Reclamos</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">Cobros</TableHead>
                <TableHead className="text-right">Pagos</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.polla_current_account_id}>
                  <TableCell>{row.user_number ?? ''}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{row.user_name}</TableCell>
                  <TableCell className="text-right tabular-nums">${fmtMoney(row.pass)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(row.successes)}
                  </TableCell>
                  {editCell(row, 'claims')}
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(row.subtotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(row.previous_balance)}
                  </TableCell>
                  {editCell(row, 'collections')}
                  {editCell(row, 'paid')}
                  <TableCell className="text-right font-semibold tabular-nums">
                    ${fmtMoney(row.total)}
                  </TableCell>
                </TableRow>
              ))}
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
