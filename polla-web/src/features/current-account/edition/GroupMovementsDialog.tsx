import { useState } from 'react';
import dayjs from 'dayjs';
import { Pencil, Trash2 } from 'lucide-react';
import { IPollaGroupEditionMovement } from '@helper/polla/types/game.type';
import { useGroupEditionMovements } from '@/hooks/fetchs/usePollaData';
import {
  useDeleteGroupMovement,
  useUpdateGroupMovement,
} from '@/hooks/mutations/usePollaMutations';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
import { parseAmount } from '@/lib/editionAccount';
import { cn } from '@/lib/utils';
import { fmtMoney } from '../format';

const LABEL: Record<IPollaGroupEditionMovement['type'], string> = {
  COLLECTION: 'Cobro',
  PAYMENT: 'Pago',
};

const fmtDate = (value: string) => dayjs(value).format('DD/MM/YYYY');

/**
 * "Movimientos" de un grupo en la edición: los cobros y pagos que entraron al
 * liquidarlo, para corregir el monto (siempre > 0, sin cambiar el tipo) o
 * borrar uno. No da de alta: los nuevos se cargan al liquidar el grupo.
 */
export const GroupMovementsDialog = ({
  editionId,
  groupId,
  groupName,
  organizationId,
  onClose,
}: {
  editionId: string;
  groupId: string;
  groupName: string;
  organizationId: string | null;
  onClose: () => void;
}) => {
  const {
    data: movements = [],
    isFetching,
    isError,
    refetch,
  } = useGroupEditionMovements(editionId, groupId, organizationId);
  const { mutate: update, isPending: updating } = useUpdateGroupMovement();
  const { mutate: remove, isPending: removing } = useDeleteGroupMovement();

  const [editing, setEditing] = useState<IPollaGroupEditionMovement | null>(null);
  const [deleting, setDeleting] = useState<IPollaGroupEditionMovement | null>(null);
  const [amount, setAmount] = useState('');

  const busy = updating || removing;
  const parsed = parseAmount(amount);
  // En centavos: la base guarda 2 decimales y un monto que redondea a 0 no vale.
  const amountValue = parsed === null ? null : Math.round(parsed * 100) / 100;
  const validAmount = amountValue !== null && amountValue > 0;

  const stopEditing = () => {
    setEditing(null);
    setAmount('');
  };

  const startEdit = (movement: IPollaGroupEditionMovement) => {
    setEditing(movement);
    setAmount(String(Number(movement.amount)));
  };

  const save = () => {
    if (!editing || !validAmount) return;
    update(
      { id: editing.polla_group_edition_movement_id, organizationId, amount: amountValue },
      { onSuccess: stopEditing }
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.polla_group_edition_movement_id;
    if (editing?.polla_group_edition_movement_id === id) stopEditing();
    remove({ id, organizationId }, { onSettled: () => setDeleting(null) });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Movimientos de {groupName}</DialogTitle>
          <DialogDescription>
            Cobros y pagos del grupo en la edición. Se cargan al liquidar el grupo; acá se corrige
            el monto o se borran.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isError && movements.length === 0 ? (
            <div className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-destructive">No se pudieron cargar los movimientos.</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : movements.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {isFetching ? 'Cargando…' : 'No hay movimientos del grupo en la edición.'}
            </p>
          ) : (
            <ul aria-label="Movimientos del grupo">
              {movements.map((movement) => {
                const id = movement.polla_group_edition_movement_id;
                return (
                  <li
                    key={id}
                    className={cn(
                      'flex items-center gap-2 border-b px-2 py-2 text-sm last:border-0',
                      editing?.polla_group_edition_movement_id === id && 'bg-muted/60'
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {fmtDate(movement.date)} · {LABEL[movement.type]} ·{' '}
                      <span className="font-medium tabular-nums">${fmtMoney(movement.amount)}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Editar monto"
                      aria-label={`Editar el ${LABEL[movement.type].toLowerCase()} del ${fmtDate(movement.date)}`}
                      disabled={busy}
                      onClick={() => startEdit(movement)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Eliminar"
                      aria-label={`Eliminar el ${LABEL[movement.type].toLowerCase()} del ${fmtDate(movement.date)}`}
                      disabled={busy}
                      onClick={() => setDeleting(movement)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {editing && (
          <form
            className="flex flex-col gap-2 border-t pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Label htmlFor="group-movement-amount">
              Monto del {LABEL[editing.type].toLowerCase()} del {fmtDate(editing.date)}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="group-movement-amount"
                inputMode="decimal"
                autoFocus
                aria-invalid={(amount.trim() !== '' && !validAmount) || undefined}
                className="w-40 text-right tabular-nums aria-[invalid]:border-destructive"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={stopEditing}>
                  Cancelar edición
                </Button>
                <Button type="submit" disabled={!validAmount || busy}>
                  {updating ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tiene que ser mayor a 0. No cambia la fecha de la liquidación.
            </p>
          </form>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {deleting && (
        <ConfirmDialog
          title="¿Eliminar el movimiento?"
          description={
            <>
              {LABEL[deleting.type]} por{' '}
              <span className="font-medium tabular-nums">${fmtMoney(deleting.amount)}</span> del{' '}
              {fmtDate(deleting.date)}. El Debe del grupo se recalcula sin él.
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
