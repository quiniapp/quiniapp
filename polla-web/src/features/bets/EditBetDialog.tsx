import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { IPollaBetEntityFront } from '@helper/polla/types/game.type';
import {
  PollaNumberBoxes,
  createEmptyPollaNumbers,
  pollaNumbersError,
} from '@/components/PollaNumberBoxes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateBet } from '@/hooks/mutations/usePollaMutations';

interface EditBetDialogProps {
  bet: IPollaBetEntityFront | null;
  onClose: () => void;
}

export const EditBetDialog = ({ bet, onClose }: EditBetDialogProps) => {
  const [numbers, setNumbers] = useState<string[]>(createEmptyPollaNumbers());
  const { mutate, isPending } = useUpdateBet();

  useEffect(() => {
    if (bet) setNumbers([...bet.numbers]);
  }, [bet]);

  const handleSave = () => {
    const error = pollaNumbersError(numbers);
    if (error) {
      toast.error(error);
      return;
    }
    if (!bet) return;

    mutate({ id: bet.polla_bet_id, numbers }, { onSuccess: onClose });
  };

  return (
    <Dialog open={Boolean(bet)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar jugada {bet?.ticket_number}</DialogTitle>
        </DialogHeader>

        <PollaNumberBoxes values={numbers} onChange={setNumbers} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
