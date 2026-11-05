import { useMemo, useState } from 'react';
import { AccountPeriodView } from '@/lib/accountPeriod';
import { hasAccountMovement } from '@/functions/current-account/liquidationSlipPDF';
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
import { Label } from '@/components/ui/label';
import { fmtMoney } from '../format';

/**
 * "Exportar liquidación": qué pasadores exportar (un PDF por pasador). Vienen
 * tildados los que tuvieron movimiento en el período; los que tienen todo en 0
 * quedan sin tildar y se pueden sumar a mano.
 */
export const ExportLiquidationsDialog = ({
  accounts,
  cashierCodeOf,
  exporting,
  onExport,
  onClose,
}: {
  accounts: AccountPeriodView[];
  cashierCodeOf: (account: AccountPeriodView) => string;
  exporting: boolean;
  onExport: (selected: AccountPeriodView[]) => void;
  onClose: () => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        accounts.filter(hasAccountMovement).map((account) => account.polla_current_account_id)
      )
  );
  const withoutMovement = useMemo(
    () => accounts.filter((account) => !hasAccountMovement(account)).length,
    [accounts]
  );

  const allSelected = selected.size === accounts.length;
  const toggleAll = (checked: boolean) =>
    setSelected(
      checked ? new Set(accounts.map((account) => account.polla_current_account_id)) : new Set()
    );
  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const chosen = accounts.filter((account) => selected.has(account.polla_current_account_id));

  return (
    <Dialog open onOpenChange={(next) => !next && !exporting && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Exportar liquidación</DialogTitle>
          <DialogDescription>
            Se descarga un PDF por pasador.
            {withoutMovement > 0 &&
              ` ${withoutMovement === 1 ? 'El que no tuvo' : `Los ${withoutMovement} que no tuvieron`} movimiento en el período ${withoutMovement === 1 ? 'viene' : 'vienen'} sin tildar.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b pb-2">
          <Checkbox
            id="export-all"
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          <Label htmlFor="export-all" className="cursor-pointer py-1">
            Seleccionar todos ({selected.size} de {accounts.length})
          </Label>
        </div>

        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" aria-label="Pasadores">
          {accounts.map((account) => {
            const id = account.polla_current_account_id;
            const code = cashierCodeOf(account);
            const moved = hasAccountMovement(account);
            return (
              <li key={id} className="flex items-center gap-2 border-b py-1.5 last:border-0">
                <Checkbox
                  id={`export-${id}`}
                  checked={selected.has(id)}
                  onCheckedChange={(checked) => toggle(id, checked === true)}
                />
                <Label
                  htmlFor={`export-${id}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 font-normal"
                >
                  <span className="min-w-0 truncate">
                    {code ? `${code} · ` : ''}
                    {account.user_name}
                  </span>
                  <span
                    className={
                      moved ? 'shrink-0 tabular-nums' : 'shrink-0 text-xs text-muted-foreground'
                    }
                  >
                    {moved ? `$${fmtMoney(account.total)}` : 'Sin movimiento'}
                  </span>
                </Label>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={exporting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onExport(chosen)}
            disabled={chosen.length === 0 || exporting}
          >
            {exporting
              ? 'Exportando…'
              : `Exportar ${chosen.length} ${chosen.length === 1 ? 'PDF' : 'PDFs'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
