import { useState } from 'react';
import dayjs from 'dayjs';
import { Pencil, Trash2 } from 'lucide-react';
import {
  IPollaEditionAccountMovement,
  POLLA_ACCOUNT_MOVEMENT_LABEL,
  POLLA_ACCOUNT_MOVEMENT_TYPE,
} from '@helper/polla/types/game.type';
import { useEditionMovements } from '@/hooks/fetchs/usePollaData';
import {
  useCreateAccountMovement,
  useDeleteAccountMovement,
  useUpdateAccountMovement,
} from '@/hooks/mutations/usePollaMutations';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { todayIso } from '@/lib/dates';
import { fmtMoney } from '../format';

/**
 * Cobros, pagos y reclamos de un pasador en la edición: alta, edición y baja.
 * Un cobro o un pago es siempre positivo; un reclamo puede ser negativo.
 */
export const MovementsDialog = ({
  editionId,
  userId,
  title,
  onClose,
}: {
  editionId: string;
  userId: string;
  /** `{grupo}-{número} · nombre`. */
  title: string;
  onClose: () => void;
}) => {
  const { data: movements = [] } = useEditionMovements(editionId, userId);
  const { mutate: create, isPending: creating } = useCreateAccountMovement();
  const { mutate: update, isPending: updating } = useUpdateAccountMovement();
  const { mutate: remove, isPending: removing } = useDeleteAccountMovement();

  const [editing, setEditing] = useState<IPollaEditionAccountMovement | null>(null);
  const [deleting, setDeleting] = useState<IPollaEditionAccountMovement | null>(null);
  const [type, setType] = useState<POLLA_ACCOUNT_MOVEMENT_TYPE>(
    POLLA_ACCOUNT_MOVEMENT_TYPE.COLLECTION
  );
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');

  const reset = () => {
    setEditing(null);
    setAmount('');
    setDate(todayIso());
    setNote('');
  };

  const startEdit = (movement: IPollaEditionAccountMovement) => {
    setEditing(movement);
    setType(movement.type);
    setAmount(String(movement.amount));
    setDate(movement.date);
    setNote(movement.note ?? '');
  };

  const amountValue = Number(amount);
  const isClaim = type === POLLA_ACCOUNT_MOVEMENT_TYPE.CLAIM;
  const validAmount =
    amount.trim() !== '' &&
    Number.isFinite(amountValue) &&
    amountValue !== 0 &&
    (isClaim || amountValue > 0);
  const busy = creating || updating || removing;

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.polla_edition_account_movement_id;
    if (editing?.polla_edition_account_movement_id === id) reset();
    remove({ id }, { onSettled: () => setDeleting(null) });
  };

  const submit = () => {
    if (!validAmount) return;
    if (editing) {
      update(
        {
          id: editing.polla_edition_account_movement_id,
          amount: amountValue,
          date,
          note: note.trim(),
        },
        { onSuccess: reset }
      );
      return;
    }
    create(
      {
        editionId,
        polla_user_id: userId,
        type,
        amount: amountValue,
        date,
        note: note.trim() || undefined,
      },
      { onSuccess: reset }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Movimientos</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {movements.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No hay movimientos en la edición.</p>
          ) : (
            <ul aria-label="Movimientos">
              {movements.map((movement) => (
                <li
                  key={movement.polla_edition_account_movement_id}
                  className="flex items-center gap-2 border-b py-2 text-sm last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">
                      {dayjs(movement.date).format('DD/MM/YYYY')} ·{' '}
                      {POLLA_ACCOUNT_MOVEMENT_LABEL[movement.type]} ·{' '}
                      <span className="font-medium tabular-nums">${fmtMoney(movement.amount)}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {movement.created_by_name ?? '-'}
                      {movement.note ? ` · ${movement.note}` : ''}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Editar movimiento"
                    disabled={busy}
                    onClick={() => startEdit(movement)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar movimiento"
                    disabled={busy}
                    onClick={() => setDeleting(movement)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="grid grid-cols-2 gap-3 border-t pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as POLLA_ACCOUNT_MOVEMENT_TYPE)}
              disabled={editing !== null}
            >
              <SelectTrigger className="w-full" aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(POLLA_ACCOUNT_MOVEMENT_TYPE).map((value) => (
                  <SelectItem key={value} value={value}>
                    {POLLA_ACCOUNT_MOVEMENT_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="movement-amount">Monto</Label>
            <Input
              id="movement-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="movement-date">Fecha</Label>
            <DateInput id="movement-date" value={date} onValueChange={setDate} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="movement-note">Nota</Label>
            <Input
              id="movement-note"
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            {editing && (
              <Button type="button" variant="outline" onClick={reset} disabled={busy}>
                Cancelar edición
              </Button>
            )}
            <Button type="submit" disabled={!validAmount || busy}>
              {editing ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </form>
      </DialogContent>

      {deleting && (
        <ConfirmDialog
          title="¿Eliminar el movimiento?"
          description={
            <>
              {POLLA_ACCOUNT_MOVEMENT_LABEL[deleting.type]} por{' '}
              <span className="font-medium tabular-nums">${fmtMoney(deleting.amount)}</span> del{' '}
              {dayjs(deleting.date).format('DD/MM/YYYY')}. La cuenta del pasador se recalcula sin
              él.
            </>
          }
          confirmLabel="Eliminar"
          destructive
          busy={removing}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Dialog>
  );
};
