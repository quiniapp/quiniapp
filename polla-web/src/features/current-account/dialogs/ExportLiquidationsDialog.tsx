import { useEffect, useMemo, useRef, useState } from 'react';
import { POLLA_LIQUIDATION_NO_GROUP } from '@helper/polla/types/game.type';
import { AccountPeriodView } from '@/lib/accountPeriod';
import { filterByGroup, pickedVisible } from '@/lib/cashierPick';
import type { LiquidationFormat } from '@/functions/current-account/liquidationDelivery';
import { hasAccountMovement } from '@/lib/liquidationSlip';
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
import { fmtMoney } from '../format';
import { LiquidationFormatToggle, exportActionLabel } from './LiquidationFormat';

/**
 * Lista de pasadores para elegir a quiénes aplicar una acción (exportar o
 * liquidar). Vienen tildados los que tuvieron movimiento; los que tienen todo
 * en 0 quedan sin tildar y se pueden sumar a mano. Con `groups` se puede
 * filtrar por grupo (incluido "Sin grupo"): la acción va solo a los tildados
 * que se ven con ese filtro (los de otros grupos siguen tildados, pero no
 * entran), y el botón dice cuántos son.
 */
export const CashierPickDialog = <T,>({
  title,
  description,
  items,
  idOf,
  labelOf,
  totalOf,
  hasMovement,
  groups,
  groupIdOf,
  actionLabel,
  listLabel = 'Pasadores',
  busyLabel,
  busy,
  format,
  onFormatChange,
  onSelectionChange,
  pendingShare,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  items: T[];
  idOf: (item: T) => string;
  /** `{grupo}-{número} · nombre`. */
  labelOf: (item: T) => string;
  /** Si viene, se muestra el monto de los que tienen movimiento. */
  totalOf?: (item: T) => number;
  hasMovement: (item: T) => boolean;
  /** Filtro de grupo: las opciones y el grupo de cada ítem. */
  groups?: { value: string; label: string }[];
  groupIdOf?: (item: T) => string | null;
  /** Nombre de la lista para lectores de pantalla. */
  listLabel?: string;
  /** Texto del botón con la cantidad elegida y el formato (si hay selector). */
  actionLabel: (count: number, format: LiquidationFormat) => string;
  busyLabel: string;
  busy: boolean;
  /** Si viene, el selector PDF | Imagen arriba de la lista. */
  format?: LiquidationFormat;
  onFormatChange?: (format: LiquidationFormat) => void;
  /** Cambió lo que se exportaría (tildes o filtro de grupo). */
  onSelectionChange?: () => void;
  /** Imágenes ya preparadas que el navegador no dejó compartir: el botón pasa a "Compartir". */
  pendingShare?: () => void;
  onConfirm: (selected: T[]) => void;
  onClose: () => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter(hasMovement).map(idOf))
  );
  const [groupFilter, setGroupFilter] = useState('');

  const visible = useMemo(
    () => filterByGroup(items, groupFilter, groupIdOf),
    [items, groupFilter, groupIdOf]
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

  const chosenKey = chosen.map(idOf).join('|');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else onSelectionChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la selección
  }, [chosenKey]);

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {format && onFormatChange && (
          <LiquidationFormatToggle value={format} onChange={onFormatChange} disabled={busy} />
        )}

        {groups && (
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
                <SelectItem key={group.value} value={group.value}>
                  {group.label}
                </SelectItem>
              ))}
              <SelectItem value={POLLA_LIQUIDATION_NO_GROUP}>Sin grupo</SelectItem>
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

        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" aria-label={listLabel}>
          {visible.map((item) => {
            const id = idOf(item);
            const moved = hasMovement(item);
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
                  <span className="min-w-0 truncate">{labelOf(item)}</span>
                  <span
                    className={
                      moved ? 'shrink-0 tabular-nums' : 'shrink-0 text-xs text-muted-foreground'
                    }
                  >
                    {moved ? (totalOf ? `$${fmtMoney(totalOf(item))}` : '') : 'Sin movimiento'}
                  </span>
                </Label>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => (pendingShare ? pendingShare() : onConfirm(chosen))}
            disabled={(chosen.length === 0 && !pendingShare) || busy}
          >
            {busy
              ? busyLabel
              : pendingShare
                ? 'Compartir'
                : actionLabel(chosen.length, format ?? 'pdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** "Exportar liquidación": un ZIP con un PDF (o una imagen) por pasador. */
export const ExportLiquidationsDialog = ({
  accounts,
  cashierCodeOf,
  exporting,
  format,
  onFormatChange,
  onSelectionChange,
  pendingShare,
  onExport,
  onClose,
}: {
  accounts: AccountPeriodView[];
  cashierCodeOf: (account: AccountPeriodView) => string;
  exporting: boolean;
  format: LiquidationFormat;
  onFormatChange: (format: LiquidationFormat) => void;
  onSelectionChange?: () => void;
  pendingShare?: () => void;
  onExport: (selected: AccountPeriodView[]) => void;
  onClose: () => void;
}) => {
  const withoutMovement = useMemo(
    () => accounts.filter((account) => !hasAccountMovement(account)).length,
    [accounts]
  );

  return (
    <CashierPickDialog
      title="Exportar liquidación"
      description={`Se descarga un ZIP con un archivo por pasador (PDF o imagen), en carpetas por grupo.${
        withoutMovement > 0
          ? ` ${withoutMovement === 1 ? 'El que no tuvo' : `Los ${withoutMovement} que no tuvieron`} movimiento en el período ${withoutMovement === 1 ? 'viene' : 'vienen'} sin tildar.`
          : ''
      }`}
      items={accounts}
      idOf={(account) => account.polla_current_account_id}
      labelOf={(account) => {
        const code = cashierCodeOf(account);
        return `${code ? `${code} · ` : ''}${account.user_name}`;
      }}
      totalOf={(account) => account.total}
      hasMovement={hasAccountMovement}
      actionLabel={exportActionLabel}
      busyLabel="Exportando…"
      busy={exporting}
      format={format}
      onFormatChange={onFormatChange}
      onSelectionChange={onSelectionChange}
      pendingShare={pendingShare}
      onConfirm={onExport}
      onClose={onClose}
    />
  );
};
