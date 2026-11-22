import { useMemo, useState } from 'react';
import type { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import type { IOrganizationEntityFront } from '@helper/types/organization.type';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { money } from '@/functions/pdf-shared';
import { NO_GROUP, filterByGroup, pickedVisible } from '@/lib/cashierPick';
import { hasAccountMovement } from '@/lib/liquidationSlip';

const idOf = (account: ICurrentAccountEntityFront) => account.current_account_id;

/**
 * "Exportar liquidación": elegir los pasadores que van al ZIP (como en la
 * Polla). Vienen tildados los que tuvieron movimiento; los que tienen la hoja
 * toda en 0 quedan sin tildar y se pueden sumar a mano. Con grupos se puede
 * filtrar por grupo (incluido "Sin grupo"): se exportan solo los tildados que
 * se ven con ese filtro, y el botón dice cuántos son.
 */
const ExportLiquidationsDialog = ({
  accounts,
  groups,
  exporting,
  onExport,
  onClose,
}: {
  accounts: ICurrentAccountEntityFront[];
  groups: IOrganizationEntityFront[];
  exporting: boolean;
  onExport: (selected: ICurrentAccountEntityFront[]) => void;
  onClose: () => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(accounts.filter(hasAccountMovement).map(idOf))
  );
  const [groupFilter, setGroupFilter] = useState('');

  // Un group_id que no es un grupo de la lista (la organización) es "Sin grupo", como en el ZIP.
  const groupIdOf = useMemo(() => {
    const ids = new Set(groups.map((group) => group.organization_id));
    return (account: ICurrentAccountEntityFront) =>
      account.group_id && ids.has(account.group_id) ? account.group_id : null;
  }, [groups]);

  const visible = useMemo(
    () => filterByGroup(accounts, groupFilter, groups.length ? groupIdOf : undefined),
    [accounts, groupFilter, groups.length, groupIdOf]
  );

  const withoutMovement = useMemo(
    () => accounts.filter((account) => !hasAccountMovement(account)).length,
    [accounts]
  );

  const allSelected = visible.length > 0 && visible.every((item) => selected.has(idOf(item)));
  const toggleAll = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((item) => (checked ? next.add(idOf(item)) : next.delete(idOf(item))));
      return next;
    });
  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  // Solo los tildados que se ven: un filtro de grupo deja afuera a los otros.
  const chosen = pickedVisible(visible, selected, idOf);
  const hiddenChosen = selected.size - chosen.length;

  return (
    <Dialog open onOpenChange={(next) => !next && !exporting && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Exportar liquidación</DialogTitle>
          <DialogDescription>
            Se descarga un ZIP con un PDF por pasador, en carpetas por grupo.
            {withoutMovement > 0 &&
              ` ${withoutMovement === 1 ? 'El que no tuvo' : `Los ${withoutMovement} que no tuvieron`} movimiento ${withoutMovement === 1 ? 'viene' : 'vienen'} sin tildar.`}
          </DialogDescription>
        </DialogHeader>

        {groups.length > 0 && (
          <Select
            value={groupFilter || 'all'}
            onValueChange={(value) => setGroupFilter(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-full" aria-label="Grupo">
              <SelectValue placeholder="Todos los grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.organization_id} value={group.organization_id}>
                  {group.name}
                </SelectItem>
              ))}
              <SelectItem value={NO_GROUP}>Sin grupo</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-2 border-b pb-2">
          <Checkbox
            id="pick-all"
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          <Label htmlFor="pick-all" className="cursor-pointer py-1">
            Seleccionar todos ({chosen.length} de {visible.length})
          </Label>
        </div>
        {hiddenChosen > 0 && (
          <p className="-mt-2 text-xs text-muted-foreground">
            {hiddenChosen === 1
              ? 'Hay 1 tildado de otro grupo: no entra.'
              : `Hay ${hiddenChosen} tildados de otros grupos: no entran.`}
          </p>
        )}

        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" aria-label="Pasadores">
          {visible.map((account) => {
            const id = idOf(account);
            const moved = hasAccountMovement(account);
            return (
              <li key={id} className="flex items-center gap-2 border-b py-1.5 last:border-0">
                <Checkbox
                  id={`pick-${id}`}
                  checked={selected.has(id)}
                  onCheckedChange={(checked) => toggle(id, checked === true)}
                />
                <Label
                  htmlFor={`pick-${id}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 font-normal"
                >
                  <span className="min-w-0 truncate">
                    {account.user_number} · {account.user_name}
                  </span>
                  <span
                    className={
                      moved ? 'shrink-0 tabular-nums' : 'shrink-0 text-xs text-muted-foreground'
                    }
                  >
                    {moved ? `$${money(Number(account.total ?? 0))}` : 'Sin movimiento'}
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

export default ExportLiquidationsDialog;
