import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  title: string;
  description?: ReactNode;
  /** Texto del botón que confirma. */
  confirmLabel: string;
  cancelLabel?: string;
  /** El botón que confirma va en rojo (borrar). */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Pide confirmación dentro de la app (en lugar de `window.confirm`). Se monta
 * abierto: el que lo usa decide cuándo mostrarlo. Escape o "Cancelar" cancelan.
 */
export const ConfirmDialog = ({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Dialog open onOpenChange={(next) => !next && !busy && onCancel()}>
    <DialogContent role="alertdialog" showCloseButton={false} className="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        )}
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'default'}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
