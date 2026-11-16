import { useState } from 'react';
import dayjs from 'dayjs';
import { AlertTriangle } from 'lucide-react';
import { IPollaCurrentAccountPeriodRow } from '@helper/polla/types/game.type';
import { pollaCurrentAccountPaymentsSchema } from '@helper/polla/schemas/game.schema';
import { useEditCurrentAccountPayments } from '@/hooks/mutations/usePollaMutations';
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
import { dayBalanceAfter, dayPayments } from '@/lib/accountPeriod';
import { fmtMoney } from '../format';

/** Vacío queda `undefined` para que el esquema lo marque como faltante. */
const toAmount = (value: string) => (value.trim() === '' ? undefined : Number(value));

const parsePayments = (collections: string, paid: string) =>
  pollaCurrentAccountPaymentsSchema.safeParse({
    collections: toAmount(collections),
    paid: toAmount(paid),
  });

/**
 * Cobros y pagos de un día del historial por fecha, liquidado o no. Recibe la
 * fila cruda (no `periodView`): se editan los montos del día, no los
 * acumulados del período que muestra la tabla. Mientras se escribe muestra el
 * saldo del día antes y después (`dayBalanceAfter`).
 */
export const EditDayPaymentsDialog = ({
  row,
  title,
  onClose,
}: {
  row: IPollaCurrentAccountPeriodRow;
  /** `{grupo}-{número} · nombre`. */
  title: string;
  onClose: () => void;
}) => {
  const { mutate, isPending } = useEditCurrentAccountPayments();
  const [initial] = useState(() => dayPayments(row));
  const [collections, setCollections] = useState(String(initial.collections));
  const [paid, setPaid] = useState(String(initial.paid));
  const [error, setError] = useState<string | null>(null);

  // El saldo con lo que va escrito; con un monto inválido o vacío, "—".
  const preview = parsePayments(collections, paid);
  const balanceAfter = preview.success ? `$${fmtMoney(dayBalanceAfter(row, preview.data))}` : '—';

  const submit = () => {
    const parsed = parsePayments(collections, paid);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Monto inválido');
      return;
    }
    setError(null);
    mutate({ id: row.polla_current_account_id, ...parsed.data }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Editar cobros y pagos</DialogTitle>
          <DialogDescription>
            {title} · {dayjs(row.date).format('DD/MM/YYYY')}
          </DialogDescription>
        </DialogHeader>

        <form
          id="edit-day-payments"
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {row.is_liquidated && (
            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              Este día ya está liquidado
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="day-collections">Cobros del día</Label>
              <Input
                id="day-collections"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={collections}
                onChange={(event) => setCollections(event.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="day-paid">Pagos del día</Label>
              <Input
                id="day-paid"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={paid}
                onChange={(event) => setPaid(event.target.value)}
              />
            </div>
          </div>

          <p className="text-sm tabular-nums" aria-live="polite">
            Saldo del día: ${fmtMoney(Number(row.total))} → {balanceAfter}
          </p>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            El saldo de los días siguientes de este pasador se recalcula.
          </p>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-day-payments" disabled={isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
