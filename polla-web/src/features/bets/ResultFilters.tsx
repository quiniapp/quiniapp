import { POLLA_HITS_FILTER } from '@helper/polla/types/game.type';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** `''` todas, `'true'` ganadoras, `'false'` no ganadoras (param `winner`). */
export type WinnerFilter = '' | 'true' | 'false';

const WINNER_OPTIONS: { value: WinnerFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Ganadores' },
  { value: 'false', label: 'No ganadores' },
];

interface ResultFiltersProps {
  winner: WinnerFilter;
  onWinnerChange: (value: WinnerFilter) => void;
  /** Aciertos tildados (10, 9, 8, 7); vacío = cualquiera. */
  hits: number[];
  onHitsChange: (hits: number[]) => void;
}

/**
 * Filtro de resultado del listado: ganadores / no ganadores / todos y, aparte,
 * aciertos exactos (10, 9, 8 y 7). Sirve para elegir los tickets que se
 * repiten sin cargo al terminar la edición.
 */
export const ResultFilters = ({
  winner,
  onWinnerChange,
  hits,
  onHitsChange,
}: ResultFiltersProps) => {
  const toggleHit = (hit: number, checked: boolean) =>
    onHitsChange(
      POLLA_HITS_FILTER.filter((value) => (value === hit ? checked : hits.includes(value)))
    );

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label id="bets-winner-label">Resultado</Label>
        <div
          role="radiogroup"
          aria-labelledby="bets-winner-label"
          className="inline-flex rounded-md border bg-card p-1"
        >
          {WINNER_OPTIONS.map((option) => {
            const active = winner === option.value;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onWinnerChange(option.value)}
                className={cn(
                  'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                  active
                    ? 'bg-nav-active text-nav-active-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <Label id="bets-hits-label">Aciertos</Label>
        <div
          role="group"
          aria-labelledby="bets-hits-label"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5"
        >
          {POLLA_HITS_FILTER.map((hit) => (
            <div key={hit} className="flex items-center gap-2">
              <Checkbox
                id={`bets-hits-${hit}`}
                checked={hits.includes(hit)}
                onCheckedChange={(checked) => toggleHit(hit, checked === true)}
              />
              <Label htmlFor={`bets-hits-${hit}`} className="cursor-pointer tabular-nums">
                {hit}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
