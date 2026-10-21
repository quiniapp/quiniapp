import { FormEvent, useState } from 'react';
import { IPollaEditionEntityFront } from '@helper/polla/types/game.type';
import { useBetToRepeat, useLastBet } from '@/hooks/fetchs/usePollaData';
import { BetNumbers } from '@/components/BetNumbers';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RepeatBetDialogProps {
  open: boolean;
  /**
   * `ticket`: se busca un ticket por número (admin+ y pasador).
   * `last`: la última jugada propia (jugador).
   */
  mode: 'ticket' | 'last';
  onClose: () => void;
  /** Ediciones que aceptan carga hoy. */
  editions: IPollaEditionEntityFront[];
  editionLabel: (edition: IPollaEditionEntityFront) => string;
  defaultEditionId: string;
  onApply: (repeat: { editionId: string; numbers: string[] }) => void;
}

/**
 * Repetir un ticket, como en QuiniApp: se busca por número (o se trae la última
 * jugada propia), se ven sus 10 números y se elige en qué edición vigente
 * cargarlos. Los números pasan al formulario para revisarlos antes de cargar.
 */
export const RepeatBetDialog = ({
  open,
  mode,
  onClose,
  editions,
  editionLabel,
  defaultEditionId,
  onApply,
}: RepeatBetDialogProps) => {
  const [ticketInput, setTicketInput] = useState('');
  const [searched, setSearched] = useState('');
  const [editionId, setEditionId] = useState(defaultEditionId);

  const byTicket = useBetToRepeat(mode === 'ticket' ? searched || null : null);
  const last = useLastBet(open && mode === 'last');
  const { data: bet, isFetching, isError } = mode === 'last' ? last : byTicket;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearched(ticketInput.trim());
  };

  const handleApply = () => {
    if (!bet || !editionId) return;
    onApply({ editionId, numbers: [...bet.numbers] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === 'last' ? 'Repetir última jugada' : 'Repetir ticket'}</DialogTitle>
          <DialogDescription>
            {mode === 'last'
              ? 'Elegí la edición y los números de tu última jugada pasan al formulario.'
              : 'Buscá el ticket, elegí la edición y los números pasan al formulario.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'ticket' && (
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            <Label htmlFor="repeat-ticket">Nº de ticket</Label>
            <div className="flex gap-2">
              <Input
                id="repeat-ticket"
                autoFocus
                inputMode="numeric"
                value={ticketInput}
                placeholder="Ej. 20261005093140042 o 20261005093140042-557"
                onChange={(e) => setTicketInput(e.target.value.replace(/[^\d-]/g, ''))}
              />
              <Button type="submit" variant="outline" disabled={!ticketInput.trim()}>
                Buscar
              </Button>
            </div>
          </form>
        )}

        {(searched || mode === 'last') && (
          <div className="min-h-[2.5rem]">
            {isFetching && <p className="text-sm text-muted-foreground">Buscando…</p>}
            {!isFetching && isError && (
              <p className="text-sm text-destructive">
                {mode === 'last'
                  ? 'Todavía no cargaste ninguna jugada.'
                  : 'No encontramos ese ticket entre los tuyos.'}
              </p>
            )}
            {!isFetching && bet && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Ticket {bet.ticket_number}</p>
                <BetNumbers numbers={bet.numbers} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Edición donde se carga</Label>
          <Select value={editionId} onValueChange={setEditionId}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí una edición" />
            </SelectTrigger>
            <SelectContent>
              {editions.map((edition) => (
                <SelectItem key={edition.polla_edition_id} value={edition.polla_edition_id}>
                  {editionLabel(edition)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleApply} disabled={!bet || !editionId || isFetching}>
            Usar estos números
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
