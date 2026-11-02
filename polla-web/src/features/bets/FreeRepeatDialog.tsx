import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  IPollaEditionEntityFront,
  IPollaRepeatResult,
  POLLA_EDITION_STATUS,
} from '@helper/polla/types/game.type';
import { useEditions } from '@/hooks/fetchs/usePollaData';
import { useFreeRepeatBets } from '@/hooks/mutations/usePollaMutations';
import { repeatReasonLabel } from '@/lib/repeatReasons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FreeRepeatDialogProps {
  betIds: string[];
  organizationId: string | null;
  editionLabel: (edition: IPollaEditionEntityFront) => string;
  onClose: () => void;
  /** Se cargaron: la pantalla limpia la selección. */
  onDone: () => void;
}

/**
 * Repetir sin cargo los tickets elegidos de una edición finalizada en una
 * edición abierta (con el corte del rol). Cada uno se carga a nombre de su
 * dueño, a $0: no suma al pase, la comisión ni lo recaudado. Al terminar se
 * ve cuántos se cargaron y cuáles no (y por qué).
 */
export const FreeRepeatDialog = ({
  betIds,
  organizationId,
  editionLabel,
  onClose,
  onDone,
}: FreeRepeatDialogProps) => {
  const { data: editions } = useEditions({
    status: POLLA_EDITION_STATUS.ACTIVE,
    loadable: true,
    polla_organization_id: organizationId ?? undefined,
  });
  const loadable = editions?.data ?? [];
  const [editionId, setEditionId] = useState('');
  const [result, setResult] = useState<IPollaRepeatResult | null>(null);
  const { mutate: freeRepeat, isPending } = useFreeRepeatBets();

  const target = loadable.find((edition) => edition.polla_edition_id === editionId);

  const handleConfirm = () => {
    if (!target) {
      toast.error('Elegí la edición donde se cargan');
      return;
    }
    freeRepeat(
      { polla_edition_id: target.polla_edition_id, polla_bet_ids: betIds },
      {
        onSuccess: (data) => {
          setResult(data);
          if (data.created.length > 0) onDone();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Repetir sin cargo</DialogTitle>
          <DialogDescription>
            {betIds.length} ticket{betIds.length === 1 ? '' : 's'}, cada uno a nombre de su dueño y
            sin cargo: no suman al pase, a la comisión ni a lo recaudado.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Se cargaron <strong>{result.created.length}</strong> sin cargo
              {target ? ` en ${editionLabel(target)}` : ''}.
            </p>
            {result.skipped.length > 0 && (
              <div className="rounded-md border border-warning bg-warning/10 p-2">
                <p className="mb-1 font-medium">No se repitieron {result.skipped.length}:</p>
                <ul className="flex flex-col gap-1">
                  {result.skipped.map((skipped) => (
                    <li key={skipped.polla_bet_id} className="break-words">
                      {skipped.ticket_number ?? skipped.polla_bet_id}
                      {skipped.user_name ? ` (${skipped.user_name})` : ''}:{' '}
                      {repeatReasonLabel(skipped.reason)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label>Edición donde se cargan</Label>
            {loadable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay ediciones abiertas para cargar en este momento.
              </p>
            ) : (
              <Select value={editionId} onValueChange={setEditionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una edición" />
                </SelectTrigger>
                <SelectContent>
                  {loadable.map((edition) => (
                    <SelectItem key={edition.polla_edition_id} value={edition.polla_edition_id}>
                      {editionLabel(edition)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {result ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button type="button" onClick={handleConfirm} disabled={!target || isPending}>
              {isPending ? 'Cargando…' : 'Repetir sin cargo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
