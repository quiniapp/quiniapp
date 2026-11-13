import { Banknote, Clock } from 'lucide-react';
import { POLLA_PAYMENT_STATUS } from '@helper/polla/types/game.type';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * "Cerrar ticket" (R04): Efectivo (pagado) o Debe (fiado). En los dos casos el
 * ticket entra al sorteo. Efectivo tiene el foco: Enter lo cierra pagado, como
 * hasta ahora.
 */
export const PaymentDialog = ({
  pending,
  onChoose,
  onClose,
}: {
  pending: boolean;
  onChoose: (status: POLLA_PAYMENT_STATUS) => void;
  onClose: () => void;
}) => (
  <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
    <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>Cerrar ticket</DialogTitle>
        <DialogDescription>¿Cómo lo paga? En los dos casos el ticket juega.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          autoFocus
          className="h-16 flex-col gap-1 text-base"
          disabled={pending}
          onClick={() => onChoose(POLLA_PAYMENT_STATUS.PAID)}
        >
          <Banknote />
          Efectivo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 flex-col gap-1 text-base"
          disabled={pending}
          onClick={() => onChoose(POLLA_PAYMENT_STATUS.OWED)}
        >
          <Clock />
          Debe
        </Button>
      </div>
      {pending && <p className="text-center text-sm text-muted-foreground">Cargando…</p>}
    </DialogContent>
  </Dialog>
);
