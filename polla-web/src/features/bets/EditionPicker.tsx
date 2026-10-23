import { IPollaEditionEntityFront } from '@helper/polla/types/game.type';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fmtMoney } from './format';

/**
 * Selector de edición con su pozo. Quiniela, turno y fechas ya están en el
 * select: debajo va solo lo que el select no dice. La cantidad de jugadas es
 * un total de admin: solo se muestra en Administrar (`showCount`).
 */
export const EditionPicker = ({
  editions,
  value,
  onChange,
  labelFor,
  showCount = false,
}: {
  editions: IPollaEditionEntityFront[];
  value: string;
  onChange: (editionId: string) => void;
  labelFor: (edition: IPollaEditionEntityFront) => string;
  showCount?: boolean;
}) => {
  const selected = editions.find((e) => e.polla_edition_id === value);

  return (
    <div className="flex min-w-0 flex-col gap-1 sm:min-w-[260px]">
      <Label>Edición</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Elegí una edición" />
        </SelectTrigger>
        <SelectContent>
          {editions.map((edition) => (
            <SelectItem key={edition.polla_edition_id} value={edition.polla_edition_id}>
              {labelFor(edition)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Pozo ${fmtMoney(selected.pool_amount)}
          {Number(selected.surprise_pool_amount ?? 0) > 0 && (
            <span className="font-semibold text-success">
              {` + sorpresa $${fmtMoney(selected.surprise_pool_amount)}`}
            </span>
          )}
          {showCount && selected.bets_count !== undefined && ` · ${selected.bets_count} jugadas`}
        </p>
      )}
    </div>
  );
};
