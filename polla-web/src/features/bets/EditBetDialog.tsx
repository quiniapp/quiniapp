import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { IPollaBetEntityFront } from '@helper/polla/types/game.type';
import { PollaNumberBoxes } from '@/components/PollaNumberBoxes';
import { createEmptyPollaNumbers, pollaNumbersError } from '@/lib/pollaNumbers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateBet } from '@/hooks/mutations/usePollaMutations';

/** Lo que hace falta para editar: también sirve la proyección de pasador/jugador. */
export type EditableBet = Pick<IPollaBetEntityFront, 'polla_bet_id' | 'ticket_number' | 'numbers'>;

interface EditBetDialogProps {
  bet: EditableBet | null;
  onClose: () => void;
}

export const EditBetDialog = ({ bet, onClose }: EditBetDialogProps) => {
  const [numbers, setNumbers] = useState<string[]>(createEmptyPollaNumbers());
  const { mutate, isPending } = useUpdateBet();

  useEffect(() => {
    if (bet) setNumbers([...bet.numbers]);
  }, [bet]);

  const handleSave = (values: string[] = numbers) => {
    const error = pollaNumbersError(values);
    if (error) {
      toast.error(error);
      return;
    }
    if (!bet) return;

    mutate({ id: bet.polla_bet_id, numbers: values }, { onSuccess: onClose });
  };

  return (
    <Dialog open={Boolean(bet)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar jugada {bet?.ticket_number}</DialogTitle>
        </DialogHeader>

        <PollaNumberBoxes values={numbers} onChange={setNumbers} onSubmit={handleSave} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => handleSave()} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
