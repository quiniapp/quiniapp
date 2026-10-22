import { FormEvent, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import {
  IPollaBetEntityBack,
  IPollaEditionEntityFront,
  IPollaRepeatResult,
} from '@helper/polla/types/game.type';
import { useBetToRepeat, useLastEditionBets } from '@/hooks/fetchs/usePollaData';
import { useRepeatBets } from '@/hooks/mutations/usePollaMutations';
import { repeatReasonLabel } from '@/lib/repeatReasons';
import { BetNumbers } from '@/components/BetNumbers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
   * `ticket`: por número de ticket, uno por vez (pasador y admin+).
   * `mine`: los tickets de la última edición en que jugó (jugador).
   */
  mode: 'ticket' | 'mine';
  onClose: () => void;
  /** Ediciones donde el usuario carga ahora. */
  editions: IPollaEditionEntityFront[];
  editionLabel: (edition: IPollaEditionEntityFront) => string;
  defaultEditionId: string;
  /** Los tickets cargados, para imprimirlos. */
  onCreated: (bets: IPollaBetEntityBack[], edition: IPollaEditionEntityFront) => Promise<void>;
}

const HOLDER_LABEL = { CASHIER: 'Pasador', PLAYER: 'Jugador' } as const;

/**
 * Repetir directo: se ven los números y se cargan en la edición elegida a
 * nombre del dueño original del ticket (si era de un jugador del pasador, al
 * jugador). El pasador repite de a uno por número de ticket y queda listo para
 * el siguiente; el jugador elige cuáles de sus tickets de la última edición.
 */
export const RepeatBetDialog = ({
  open,
  mode,
  onClose,
  editions,
  editionLabel,
  defaultEditionId,
  onCreated,
}: RepeatBetDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ticketInput, setTicketInput] = useState('');
  const [searched, setSearched] = useState('');
  const [editionId, setEditionId] = useState(
    defaultEditionId || (editions.length === 1 ? editions[0].polla_edition_id : '')
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const byTicket = useBetToRepeat(mode === 'ticket' ? searched || null : null);
  const mine = useLastEditionBets(open && mode === 'mine');
  const { mutate: repeat, isPending } = useRepeatBets();

  const myBets = mine.data ?? [];
  // Al llegar la lista del jugador, todos tildados.
  useEffect(() => {
    if (mode === 'mine' && mine.data) {
      setSelected(new Set(mine.data.map((bet) => bet.polla_bet_id)));
    }
  }, [mode, mine.data]);

  const edition = editions.find((item) => item.polla_edition_id === editionId);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearched(ticketInput.trim());
  };

  const handleResult = async (result: IPollaRepeatResult) => {
    for (const skipped of result.skipped) {
      toast.error(`Ticket ${skipped.ticket_number ?? ''}: ${repeatReasonLabel(skipped.reason)}`);
    }
    if (result.created.length === 0 || !edition) return;

    toast.success(
      result.created.length === 1 ? 'Ticket repetido' : `${result.created.length} tickets repetidos`
    );
    await onCreated(result.created, edition);
  };

  const submit = (ids: string[], after: () => void) => {
    if (!edition) {
      toast.error('Elegí la edición');
      return;
    }
    repeat(
      { polla_edition_id: edition.polla_edition_id, polla_bet_ids: ids },
      {
        onSuccess: async (result) => {
          await handleResult(result);
          after();
        },
      }
    );
  };

  const handleRepeatTicket = () => {
    if (!byTicket.data) return;
    submit([byTicket.data.polla_bet_id], () => {
      // Listo para el siguiente ticket.
      setTicketInput('');
      setSearched('');
      inputRef.current?.focus();
    });
  };

  const handleRepeatMine = () => {
    if (selected.size === 0) {
      toast.error('Elegí al menos un ticket');
      return;
    }
    submit([...selected], onClose);
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const bet = byTicket.data;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === 'mine' ? 'Repetir mis tickets' : 'Repetir ticket'}</DialogTitle>
          <DialogDescription>
            {mode === 'mine'
              ? 'Tus tickets de la última edición en que jugaste. Elegí cuáles y la edición, y se cargan.'
              : 'Buscá el ticket, revisá los números y confirmá: se carga a nombre de su dueño.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label>Edición donde se carga</Label>
          <Select value={editionId} onValueChange={setEditionId}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí una edición" />
            </SelectTrigger>
            <SelectContent>
              {editions.map((item) => (
                <SelectItem key={item.polla_edition_id} value={item.polla_edition_id}>
                  {editionLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'ticket' && (
          <>
            <form onSubmit={handleSearch} className="flex flex-col gap-2">
              <Label htmlFor="repeat-ticket">Nº de ticket</Label>
              <div className="flex gap-2">
                <Input
                  id="repeat-ticket"
                  ref={inputRef}
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

            {searched && (
              <div className="min-h-[2.5rem]">
                {byTicket.isFetching && <p className="text-sm text-muted-foreground">Buscando…</p>}
                {!byTicket.isFetching && byTicket.isError && (
                  <p className="text-sm text-destructive">
                    No encontramos ese ticket entre los que podés repetir.
                  </p>
                )}
                {!byTicket.isFetching && bet && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Ticket {bet.ticket_number} · {HOLDER_LABEL[bet.holder_type]}{' '}
                      <span className="font-medium text-foreground">{bet.user_name}</span>
                    </p>
                    <BetNumbers numbers={bet.numbers} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {mode === 'mine' && (
          <div className="flex flex-col gap-2">
            {mine.isFetching && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!mine.isFetching && myBets.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no jugaste ningún ticket.</p>
            )}
            {myBets.map((item) => (
              <label
                key={item.polla_bet_id}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-2"
              >
                <Checkbox
                  checked={selected.has(item.polla_bet_id)}
                  onCheckedChange={(checked) => toggle(item.polla_bet_id, checked === true)}
                  aria-label={`Repetir el ticket ${item.ticket_number}`}
                  className="mt-1"
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {item.ticket_number} · {dayjs(item.load_date).format('DD/MM')}
                  </span>
                  <BetNumbers numbers={item.numbers} />
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {mode === 'ticket' ? 'Listo' : 'Cancelar'}
          </Button>
          {mode === 'ticket' ? (
            <Button
              type="button"
              onClick={handleRepeatTicket}
              disabled={!bet || !editionId || byTicket.isFetching || isPending}
            >
              {isPending ? 'Cargando…' : 'Cargar e imprimir'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleRepeatMine}
              disabled={selected.size === 0 || !editionId || isPending}
            >
              {isPending
                ? 'Cargando…'
                : `Cargar ${selected.size} ticket${selected.size === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
